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

CREATE TABLE IF NOT EXISTS image_generations (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locale VARCHAR(2) NOT NULL CHECK (locale IN ('pt', 'es')),
  business_unit VARCHAR(40) NOT NULL,
  model VARCHAR(80) NOT NULL,
  quality VARCHAR(16) NOT NULL,
  image_size VARCHAR(24) NOT NULL,
  output_format VARCHAR(12) NOT NULL,
  prompt_version VARCHAR(40) NOT NULL,
  openai_request_id VARCHAR(120),
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  text_input_tokens INTEGER NOT NULL CHECK (text_input_tokens >= 0),
  image_input_tokens INTEGER NOT NULL CHECK (image_input_tokens >= 0),
  image_output_tokens INTEGER NOT NULL CHECK (image_output_tokens >= 0),
  total_tokens INTEGER NOT NULL CHECK (total_tokens >= 0),
  estimated_cost_micro_usd BIGINT NOT NULL CHECK (estimated_cost_micro_usd >= 0)
);

CREATE INDEX IF NOT EXISTS image_generations_created_at_idx ON image_generations (created_at DESC);
CREATE INDEX IF NOT EXISTS image_generations_business_unit_idx ON image_generations (business_unit);
CREATE INDEX IF NOT EXISTS image_generations_model_idx ON image_generations (model);
