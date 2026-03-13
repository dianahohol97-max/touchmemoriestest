#!/bin/bash

# Touch Memories - Admin Pages Test Script
# Tests all admin/CRM pages and reports status

BASE_URL="http://localhost:3000"
RESULTS_FILE="test-admin-results.txt"

echo "🔐 Touch Memories - Admin Panel QA Test" > $RESULTS_FILE
echo "=======================================" >> $RESULTS_FILE
echo "Started: $(date)" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE

test_page() {
    local url=$1
    local name=$2

    echo -n "Testing $name... "

    status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$url" 2>&1)

    if [ "$status" = "200" ]; then
        echo "✅ PASS ($status)"
        echo "✅ $name - $url - Status: $status" >> $RESULTS_FILE
    elif [ "$status" = "302" ] || [ "$status" = "307" ]; then
        echo "🔄 REDIRECT ($status) - Likely auth required"
        echo "🔄 $name - $url - Status: $status - REDIRECT (Auth)" >> $RESULTS_FILE
    elif [ "$status" = "404" ]; then
        echo "❌ FAIL ($status) - Page Not Found"
        echo "❌ $name - $url - Status: $status - NOT FOUND" >> $RESULTS_FILE
    elif [ "$status" = "500" ]; then
        echo "❌ FAIL ($status) - Server Error"
        echo "❌ $name - $url - Status: $status - SERVER ERROR" >> $RESULTS_FILE
    else
        echo "⚠️  WARN ($status)"
        echo "⚠️  $name - $url - Status: $status" >> $RESULTS_FILE
    fi
}

echo "🏠 Admin Core Pages"
echo "" >> $RESULTS_FILE
echo "=== ADMIN CORE ===" >> $RESULTS_FILE

test_page "/admin" "Admin Dashboard"
test_page "/admin/login" "Admin Login"

echo ""
echo "=== ORDERS MANAGEMENT ===" >> $RESULTS_FILE
echo "📦 Orders"

test_page "/admin/orders" "Orders List"
test_page "/admin/orders/new" "Create New Order"
test_page "/admin/production" "Production Queue"
test_page "/admin/production/queue" "Production Queue Detail"
test_page "/admin/design-orders" "Design Orders"

echo ""
echo "=== CUSTOMER MANAGEMENT ===" >> $RESULTS_FILE
echo "👥 Customers"

test_page "/admin/customers" "Customers List"

echo ""
echo "=== PRODUCT/CATALOG ===" >> $RESULTS_FILE
echo "📦 Products & Catalog"

test_page "/admin/catalog" "Catalog Management"
test_page "/admin/catalog/categories" "Catalog Categories"
test_page "/admin/catalog/featured" "Featured Products"
test_page "/admin/catalog/product/new" "New Product Form"
test_page "/admin/products" "Products List"
test_page "/admin/products/new" "New Product (Alt)"
test_page "/admin/inventory" "Inventory Management"
test_page "/admin/categories" "Categories Management"
test_page "/admin/constructor-types" "Constructor Types"

echo ""
echo "=== BLOG MANAGEMENT ===" >> $RESULTS_FILE
echo "📝 Blog"

test_page "/admin/blog" "Blog Posts"
test_page "/admin/blog/new" "New Blog Post"
test_page "/admin/blog/categories" "Blog Categories"
test_page "/admin/faq" "FAQ Management"
test_page "/admin/faq/new" "New FAQ"

echo ""
echo "=== TEAM & STAFF ===" >> $RESULTS_FILE
echo "👨‍💼 Team"

test_page "/admin/staff" "Staff Management"
test_page "/admin/salary" "Salary Management"
test_page "/admin/role-pricing" "Role Pricing"
test_page "/admin/settings/team/roles" "Team Roles"

echo ""
echo "=== FINANCES ===" >> $RESULTS_FILE
echo "💰 Finances"

test_page "/admin/finances/expenses" "Expenses"
test_page "/admin/finances/expenses/recurring" "Recurring Expenses"
test_page "/admin/finances/report" "Financial Reports"
test_page "/admin/settings/finance/banks" "Bank Accounts"

echo ""
echo "=== SETTINGS ===" >> $RESULTS_FILE
echo "⚙️  Settings"

test_page "/admin/settings/chatbot" "Chatbot Settings"
test_page "/admin/settings/delivery/nova-poshta" "Nova Poshta Settings"
test_page "/admin/settings/fiscalization" "Fiscalization"
test_page "/admin/settings/print-profiles" "Print Profiles"
test_page "/admin/settings/tags" "Tags Management"

echo ""
echo "=== OTHER FEATURES ===" >> $RESULTS_FILE
echo "🔧 Other"

test_page "/admin/templates" "Templates"
test_page "/admin/social-inbox" "Social Inbox"
test_page "/admin/email" "Email Management"
test_page "/admin/theme-editor" "Theme Editor"

echo ""
echo "=======================================" >> $RESULTS_FILE
echo "Completed: $(date)" >> $RESULTS_FILE
echo ""
echo "✨ Admin test completed! Check test-admin-results.txt for details"
cat $RESULTS_FILE
