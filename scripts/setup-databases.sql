-- PostgreSQL Database Setup Script
-- Run this script on PostgreSQL server to create all databases for microservices
--
-- Usage:
--   psql -U postgres < setup-databases.sql
-- Or:
--   docker exec -i postgres_container psql -U postgres < setup-databases.sql

-- ================================================
-- Create Databases for Each Microservice
-- ================================================

-- User Service Database
CREATE DATABASE user_db;

-- Product Service Database
CREATE DATABASE product_db;

-- Order Service Database
CREATE DATABASE order_db;

-- Cart Service Database
CREATE DATABASE cart_db;

-- Payment Service Database
CREATE DATABASE payment_db;

-- Report Service Database
CREATE DATABASE report_db;

-- AR Service Database
CREATE DATABASE ar_db;

-- ================================================
-- Optional: Create Dedicated Users Per Database
-- ================================================
-- Uncomment below to create separate users for each service with limited permissions
-- This is MORE SECURE than using postgres user for all services

-- CREATE USER user_app WITH PASSWORD 'user_password';
-- GRANT ALL PRIVILEGES ON DATABASE user_db TO user_app;

-- CREATE USER product_app WITH PASSWORD 'product_password';
-- GRANT ALL PRIVILEGES ON DATABASE product_db TO product_app;

-- CREATE USER order_app WITH PASSWORD 'order_password';
-- GRANT ALL PRIVILEGES ON DATABASE order_db TO order_app;

-- CREATE USER cart_app WITH PASSWORD 'cart_password';
-- GRANT ALL PRIVILEGES ON DATABASE cart_db TO cart_app;

-- CREATE USER payment_app WITH PASSWORD 'payment_password';
-- GRANT ALL PRIVILEGES ON DATABASE payment_db TO payment_app;

-- CREATE USER report_app WITH PASSWORD 'report_password';
-- GRANT ALL PRIVILEGES ON DATABASE report_db TO report_app;

-- CREATE USER ar_app WITH PASSWORD 'ar_password';
-- GRANT ALL PRIVILEGES ON DATABASE ar_db TO ar_app;

-- ================================================
-- Alternative: Single Database with Schemas
-- ================================================
-- Uncomment below to use single database with separate schemas per app
-- This requires using ?schema=schema_name in Prisma DATABASE_URL

-- CREATE DATABASE luan_van_db;

-- CREATE SCHEMA user_schema;
-- CREATE SCHEMA product_schema;
-- CREATE SCHEMA order_schema;
-- CREATE SCHEMA cart_schema;
-- CREATE SCHEMA payment_schema;
-- CREATE SCHEMA report_schema;
-- CREATE SCHEMA ar_schema;

-- GRANT ALL PRIVILEGES ON DATABASE luan_van_db TO postgres;

