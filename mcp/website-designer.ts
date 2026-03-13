import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from 'dotenv';
import { createClient } from "@supabase/supabase-js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { join } from 'path';

// Load env specific to the NextJS project
// Adjust if you run this from root vs from mcp directory
config({ path: join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const server = new Server(
    {
        name: "website-designer",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Define tool schemas
const tools: Tool[] = [
    {
        name: "get_current_theme",
        description: "Reads the current global theme configurations from Supabase. Returns all colors, fonts, spacing, and button styling variables as a JSON object.",
        inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
    },
    {
        name: "update_theme",
        description: "Accepts a partial or full theme settings object and updates the global theme. Valid keys: color_primary (hex), font_family_body, border_radius, button_border_radius, spacing_unit, color_secondary, etc. Use this to change the website layout variables in real-time.",
        inputSchema: {
            type: "object",
            properties: {
                settings: {
                    type: "object",
                    description: "Key-value pairs of CSS/Theme overrides.",
                    additionalProperties: true
                }
            },
            required: ["settings"],
            additionalProperties: false,
        },
    },
    {
        name: "apply_preset",
        description: "Forcefully switches the global theme to one of the configured presets. Valid presets: minimal, elegant, bold, warm, corporate. This overrides all existing settings with the preset map.",
        inputSchema: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "One of the preset names: 'minimal', 'elegant', 'bold', 'warm', 'corporate'",
                }
            },
            required: ["name"],
            additionalProperties: false,
        },
    },
    {
        name: "check_accessibility",
        description: "Calculates WCAG contrast luminosity across the active color pairings (e.g. text vs background, button text vs primary, secondary vs text). Evaluates font sizes based on a 14px minimum. Returns a JSON health report outlining passes, fails, warnings, and adjustments.",
        inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
    },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
});

// Calculate Relative Luminance
function getLuminance(r: number, g: number, b: number) {
    const a = [r, g, b].map(function (v) {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

// Convert Hex to RGB
function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Compute Contrast Ratio
function getContrastRatio(color1: string, color2: string) {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);

    if (!rgb1 || !rgb2) return 1;

    const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        if (name === "get_current_theme") {
            const { data, error } = await supabase.from('theme_settings').select('*').limit(1).single();
            if (error) throw new Error(error.message);

            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            };
        }

        if (name === "update_theme" && args) {
            // @ts-ignore
            const { settings } = args;

            const { data: existingData, error: fetchError } = await supabase.from('theme_settings').select('id').limit(1).single();
            if (fetchError) throw new Error(fetchError.message);

            const { data, error } = await supabase
                .from('theme_settings')
                .update(settings)
                .eq('id', existingData.id)
                .select()
                .single();

            if (error) throw new Error(error.message);

            return {
                content: [{ type: "text", text: JSON.stringify({ success: true, updated_theme: data }, null, 2) }],
            };
        }

        if (name === "apply_preset" && args) {
            // @ts-ignore
            const { name: presetName } = args;

            const { data: preset, error: presetError } = await supabase.from('theme_presets').select('settings').eq('name', presetName).single();

            if (presetError || !preset) {
                throw new Error(`Preset '${presetName}' not found. Available keys: minimal, elegant, bold, warm, corporate.`);
            }

            const { data: existingData, error: fetchError } = await supabase.from('theme_settings').select('id').limit(1).single();
            if (fetchError) throw new Error(fetchError.message);

            const { data: updatedTheme, error: updateError } = await supabase
                .from('theme_settings')
                .update(preset.settings)
                .eq('id', existingData.id)
                .select()
                .single();

            if (updateError) throw new Error(updateError.message);

            return {
                content: [{ type: "text", text: JSON.stringify({ success: true, applied_preset: presetName, updated_theme: updatedTheme }, null, 2) }],
            };
        }

        if (name === "check_accessibility") {
            const { data: theme, error } = await supabase.from('theme_settings').select('*').limit(1).single();
            if (error) throw new Error(error.message);

            const issues: string[] = [];
            const suggestions: string[] = [];
            let passed = true;

            // Check text against background
            const textBgRatio = getContrastRatio(theme.color_text, theme.color_background);
            if (textBgRatio < 4.5) {
                passed = false;
                issues.push(`Global Text (${theme.color_text}) against Background (${theme.color_background}) has insufficient contrast: ${textBgRatio.toFixed(2)} (Minimum is 4.5:1).`);
            }

            // Check primary button text against primary
            const primaryBtnRatio = getContrastRatio(theme.button_text_primary, theme.color_primary);
            if (primaryBtnRatio < 4.5) {
                passed = false;
                issues.push(`Primary Button Text (${theme.button_text_primary}) against Primary Color (${theme.color_primary}) has insufficient contrast: ${primaryBtnRatio.toFixed(2)}.`);
            }

            // Font sizes
            if (theme.font_size_body < 14) {
                passed = false;
                issues.push(`Body font size is ${theme.font_size_body}px. Minimum recommended is 14px for readability.`);
            }

            const report = {
                passed,
                issues: issues.length > 0 ? issues : ["No strict WCAG violations detected."],
                suggestions: issues.length > 0 ? ["Use a contrast checker to adjust lightness/darkness of your hex codes until the ratio exceeds 4.5:1."] : ["Looks great! Contrast is clear."],
                metrics: {
                    text_to_background_ratio: textBgRatio.toFixed(2),
                    primary_button_ratio: primaryBtnRatio.toFixed(2)
                }
            };

            return {
                content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
            };
        }

        throw new Error(`Unknown tool: ${name}`);
    } catch (error: any) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
        };
    }
});

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Website Designer MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
