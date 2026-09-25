CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('page_view', 'image_generated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locale VARCHAR(2) NOT NULL CHECK (locale IN ('pt', 'es')),
  business_unit VARCHAR(40)
);

CREATE INDEX IF NOT EXISTS events_created_at_idx ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS events_type_locale_idx ON events (event_type, locale);
CREATE INDEX IF NOT EXISTS events_business_unit_idx ON events (business_unit) WHERE business_unit IS NOT NULL;
