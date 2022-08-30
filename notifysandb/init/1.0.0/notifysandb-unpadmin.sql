--
-- PostgreSQL database dump
--

-- Dumped from database version 9.6.6
-- Dumped by pg_dump version 10.12

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: unpadmin; Type: SCHEMA; Schema: -; Owner: unpadmin
--

CREATE SCHEMA unpadmin;


ALTER SCHEMA unpadmin OWNER TO unpadmin;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: clients; Type: TABLE; Schema: unpadmin; Owner: unpadmin
--

CREATE TABLE unpadmin.clients (
    client_id character(36) NOT NULL,
    reference_email character varying(255) NOT NULL,
    product character varying(255),
    subscription_date timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    preference_service_name character varying(255) NOT NULL,
    token_notify text
);


ALTER TABLE unpadmin.clients OWNER TO unpadmin;

--
-- Name: users_permissions; Type: TABLE; Schema: unpadmin; Owner: unpadmin
--

CREATE TABLE unpadmin.users_permissions (
    cf character varying(255) NOT NULL,
    username character varying(255),
    roles character varying(255)
);


ALTER TABLE unpadmin.users_permissions OWNER TO unpadmin;

--
-- Name: idx_10515419_name; Type: INDEX; Schema: unpadmin; Owner: unpadmin
--

CREATE UNIQUE INDEX idx_10515419_name ON unpadmin.clients USING btree (preference_service_name);


--
-- Name: idx_10515419_primary; Type: INDEX; Schema: unpadmin; Owner: unpadmin
--

CREATE UNIQUE INDEX idx_10515419_primary ON unpadmin.clients USING btree (client_id);


--
-- Name: idx_10515435_primary; Type: INDEX; Schema: unpadmin; Owner: unpadmin
--

CREATE UNIQUE INDEX idx_10515435_primary ON unpadmin.users_permissions USING btree (cf);

--
-- PostgreSQL database dump complete
--


CREATE TABLE unpadmin.tags (
	uuid varchar NOT NULL,
	"name" varchar(30) NOT NULL,
	description varchar(255) NULL,
	created timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT name_unique UNIQUE (name),
	CONSTRAINT tags_pkey PRIMARY KEY (uuid)
);

-- Permissions

ALTER TABLE unpadmin.tags OWNER TO unpadmin;
GRANT ALL ON TABLE unpadmin.tags TO unpadmin;