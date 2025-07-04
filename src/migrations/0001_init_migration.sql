CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE permissions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        api_key TEXT NOT NULL,
        module TEXT NOT NULL,
        action TEXT NOT NULL,
        UNIQUE (api_key, module, action)
);