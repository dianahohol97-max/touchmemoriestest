-- Report Settings Table
CREATE TABLE IF NOT EXISTS report_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_report_enabled BOOLEAN DEFAULT TRUE,
  weekly_report_day INTEGER DEFAULT 1 CHECK (weekly_report_day BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday
  weekly_report_time TIME DEFAULT '09:00:00',
  weekly_report_recipients TEXT[] DEFAULT ARRAY[]::TEXT[],
  monthly_report_enabled BOOLEAN DEFAULT TRUE,
  monthly_report_day INTEGER DEFAULT 1 CHECK (monthly_report_day BETWEEN 1 AND 28),
  monthly_report_time TIME DEFAULT '09:00:00',
  monthly_report_recipients TEXT[] DEFAULT ARRAY[]::TEXT[],
  telegram_notifications_enabled BOOLEAN DEFAULT TRUE,
  telegram_chat_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert Thresholds Configuration
CREATE TABLE IF NOT EXISTS alert_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL UNIQUE CHECK (alert_type IN (
    'no_sales_hours',
    'sales_spike',
    'monobank_webhook_delayed',
    'checkbox_shift_not_opened',
    'low_inventory',
    'production_overdue',
    'high_error_rate'
  )),
  enabled BOOLEAN DEFAULT TRUE,
  threshold_value NUMERIC,
  threshold_unit TEXT, -- 'hours', 'percentage', 'count'
  check_interval_minutes INTEGER DEFAULT 60,
  notification_channels TEXT[] DEFAULT ARRAY['telegram', 'email']::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert History
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated Reports Archive
CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('weekly', 'monthly', 'custom')),
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  report_data JSONB NOT NULL,
  pdf_url TEXT,
  html_content TEXT,
  sent_to TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monitoring Metrics (for anomaly detection)
CREATE TABLE IF NOT EXISTS monitoring_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL CHECK (metric_type IN (
    'hourly_sales',
    'daily_orders',
    'webhook_status',
    'system_health',
    'api_response_time'
  )),
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alert_history_type ON alert_history(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_history_created ON alert_history(created_at);
CREATE INDEX IF NOT EXISTS idx_alert_history_resolved ON alert_history(resolved);
CREATE INDEX IF NOT EXISTS idx_generated_reports_type ON generated_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_generated_reports_period ON generated_reports(report_period_start, report_period_end);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_type ON monitoring_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_recorded ON monitoring_metrics(recorded_at);

-- RLS Policies
ALTER TABLE report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_metrics ENABLE ROW LEVEL SECURITY;

-- Only admins can manage report settings
CREATE POLICY "Only admins can access report_settings"
  ON report_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  );

CREATE POLICY "Only admins can access alert_thresholds"
  ON alert_thresholds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  );

-- Staff can view alerts
CREATE POLICY "Staff can view alerts"
  ON alert_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );

CREATE POLICY "Staff can resolve alerts"
  ON alert_history FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );

CREATE POLICY "System can create alerts"
  ON alert_history FOR INSERT
  WITH CHECK (true);

-- Only admins can view reports
CREATE POLICY "Only admins can access generated_reports"
  ON generated_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  );

-- System can write metrics
CREATE POLICY "System can write monitoring_metrics"
  ON monitoring_metrics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view monitoring_metrics"
  ON monitoring_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  );

-- Triggers
CREATE TRIGGER update_report_settings_updated_at
  BEFORE UPDATE ON report_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_thresholds_updated_at
  BEFORE UPDATE ON alert_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default report settings
INSERT INTO report_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Insert default alert thresholds
INSERT INTO alert_thresholds (alert_type, enabled, threshold_value, threshold_unit, check_interval_minutes) VALUES
  ('no_sales_hours', TRUE, 2, 'hours', 60),
  ('sales_spike', TRUE, 200, 'percentage', 60),
  ('monobank_webhook_delayed', TRUE, 1, 'hours', 30),
  ('checkbox_shift_not_opened', TRUE, 10, 'hour_of_day', 60),
  ('production_overdue', TRUE, 0, 'count', 60),
  ('low_inventory', FALSE, 5, 'count', 360),
  ('high_error_rate', TRUE, 10, 'percentage', 30)
ON CONFLICT (alert_type) DO NOTHING;
