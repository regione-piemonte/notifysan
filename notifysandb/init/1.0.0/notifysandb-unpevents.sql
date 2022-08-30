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
-- Name: unpevents; Type: SCHEMA; Schema: -; Owner: unpevents
--

CREATE SCHEMA unpevents;


ALTER SCHEMA unpevents OWNER TO unpevents;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: esito_ingestion_sdp; Type: TABLE; Schema: unpevents; Owner: unpevents
--

CREATE TABLE unpevents.esito_ingestion_sdp (
    id bigint NOT NULL,
    min_id_record numeric NOT NULL,
    max_id_record numeric NOT NULL,
    esito boolean NOT NULL,
    data_inizio timestamp with time zone NOT NULL,
    data_fine timestamp with time zone NOT NULL,
    num_record_elaborati bigint NOT NULL
);


ALTER TABLE unpevents.esito_ingestion_sdp OWNER TO unpevents;

--
-- Name: esito_ingestion_sdp_id_seq; Type: SEQUENCE; Schema: unpevents; Owner: unpevents
--

CREATE SEQUENCE unpevents.esito_ingestion_sdp_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE unpevents.esito_ingestion_sdp_id_seq OWNER TO unpevents;

--
-- Name: esito_ingestion_sdp_id_seq; Type: SEQUENCE OWNED BY; Schema: unpevents; Owner: unpevents
--

ALTER SEQUENCE unpevents.esito_ingestion_sdp_id_seq OWNED BY unpevents.esito_ingestion_sdp.id;


--
-- Name: events; Type: TABLE; Schema: unpevents; Owner: unpevents
--

CREATE TABLE unpevents.events (
    id bigint NOT NULL,
    uuid character varying(36) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    payload text,
    source character varying(30) NOT NULL,
    type character varying(255),
    msg_uuid character varying(255),
    bulk_id character varying(255),
    user_id character varying(255),
    tag character varying(255),
    title character varying(255),
    correlation_id character varying(255),
    me_payload text,
    error text
);


ALTER TABLE unpevents.events OWNER TO unpevents;

--
-- Name: events2; Type: TABLE; Schema: unpevents; Owner: unpevents
--

CREATE TABLE unpevents.events2 (
    id numeric NOT NULL,
    uuid character varying(36) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    payload text,
    source character varying(30) NOT NULL,
    type character varying(255) NOT NULL
);


ALTER TABLE unpevents.events2 OWNER TO unpevents;

--
-- Name: events_id_seq; Type: SEQUENCE; Schema: unpevents; Owner: unpevents
--

CREATE SEQUENCE unpevents.events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE unpevents.events_id_seq OWNER TO unpevents;

--
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: unpevents; Owner: unpevents
--

ALTER SEQUENCE unpevents.events_id_seq OWNED BY unpevents.events.id;

--
-- Name: events_sdp; Type: TABLE; Schema: unpevents; Owner: unpevents
--

CREATE TABLE unpevents.events_sdp (
    id numeric DEFAULT '0'::numeric NOT NULL,
    uuid character varying(36) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    payload text,
    source character varying(30) NOT NULL,
    type character varying(255),
    msg_uuid character varying(255),
    bulk_id character varying(255),
    user_id character varying(255),
    tag character varying(255),
    title character varying(255),
    correlation_id character varying(255),
    me_payload text,
    error text
);


ALTER TABLE unpevents.events_sdp OWNER TO unpevents;

--
-- Name: events_tobe_deleted; Type: TABLE; Schema: unpevents; Owner: unpevents
--

CREATE TABLE unpevents.events_tobe_deleted (
    id numeric NOT NULL
);


ALTER TABLE unpevents.events_tobe_deleted OWNER TO unpevents;

--
-- Name: lock_events_sdp; Type: TABLE; Schema: unpevents; Owner: unpevents
--

CREATE TABLE unpevents.lock_events_sdp (
    id bigint NOT NULL,
    data_update timestamp with time zone,
    owner_lock character varying(30),
    note text
);


ALTER TABLE unpevents.lock_events_sdp OWNER TO unpevents;

--
-- Name: messages_status; Type: TABLE; Schema: unpevents; Owner: unpevents
--

CREATE TABLE unpevents.messages_status (
    message_id character varying(255) NOT NULL,
    bulk_id character varying(255),
    email_result boolean,
    push_result boolean,
    sms_result boolean,
    io_result boolean,
    mex_result boolean,
    send_date timestamp with time zone,
    note text
);


ALTER TABLE unpevents.messages_status OWNER TO unpevents;

--
-- Name: stats; Type: TABLE; Schema: unpevents; Owner: unpevents
--

CREATE TABLE unpevents.stats (
    sender character varying(255) NOT NULL,
    date character(8) NOT NULL,
    source character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    counter numeric DEFAULT '0'::numeric NOT NULL
);


ALTER TABLE unpevents.stats OWNER TO unpevents;

--
-- Name: esito_ingestion_sdp id; Type: DEFAULT; Schema: unpevents; Owner: unpevents
--

ALTER TABLE ONLY unpevents.esito_ingestion_sdp ALTER COLUMN id SET DEFAULT nextval('unpevents.esito_ingestion_sdp_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: unpevents; Owner: unpevents
--

ALTER TABLE ONLY unpevents.events ALTER COLUMN id SET DEFAULT nextval('unpevents.events_id_seq'::regclass);


--
-- Name: esito_ingestion_sdp idx_10515500_primary; Type: CONSTRAINT; Schema: unpevents; Owner: unpevents
--

ALTER TABLE ONLY unpevents.esito_ingestion_sdp
    ADD CONSTRAINT idx_10515500_primary PRIMARY KEY (id);


--
-- Name: events idx_10515534_primary; Type: CONSTRAINT; Schema: unpevents; Owner: unpevents
--

ALTER TABLE ONLY unpevents.events
    ADD CONSTRAINT idx_10515534_primary PRIMARY KEY (id);


--
-- Name: events_tobe_deleted idx_10515852_primary; Type: CONSTRAINT; Schema: unpevents; Owner: unpevents
--

ALTER TABLE ONLY unpevents.events_tobe_deleted
    ADD CONSTRAINT idx_10515852_primary PRIMARY KEY (id);


--
-- Name: lock_events_sdp idx_10515909_primary; Type: CONSTRAINT; Schema: unpevents; Owner: unpevents
--

ALTER TABLE ONLY unpevents.lock_events_sdp
    ADD CONSTRAINT idx_10515909_primary PRIMARY KEY (id);


--
-- Name: stats idx_10516001_primary; Type: CONSTRAINT; Schema: unpevents; Owner: unpevents
--

ALTER TABLE ONLY unpevents.stats
    ADD CONSTRAINT idx_10516001_primary PRIMARY KEY (date, sender, source, type);


--
-- Name: idx_10515534_created_at_type_index; Type: INDEX; Schema: unpevents; Owner: unpevents
--

CREATE INDEX idx_10515534_created_at_type_index ON unpevents.events USING btree (created_at, type);


--
-- Name: idx_10515534_msg_uuid; Type: INDEX; Schema: unpevents; Owner: unpevents
--

CREATE INDEX idx_10515534_msg_uuid ON unpevents.events USING btree (msg_uuid);


--
-- Name: idx_10515534_payload_ft; Type: INDEX; Schema: unpevents; Owner: unpevents
--

CREATE INDEX idx_10515534_payload_ft ON unpevents.events USING gin (to_tsvector('simple'::regconfig, payload));


--
-- Name: idx_10515573_idx_events2_created_at; Type: INDEX; Schema: unpevents; Owner: unpevents
--

CREATE INDEX idx_10515573_idx_events2_created_at ON unpevents.events2 USING btree (created_at);


--
-- Name: idx_10515573_idx_events2_source; Type: INDEX; Schema: unpevents; Owner: unpevents
--

CREATE INDEX idx_10515573_idx_events2_source ON unpevents.events2 USING btree (source);


--
-- Name: idx_10515573_idx_events2_type; Type: INDEX; Schema: unpevents; Owner: unpevents
--

CREATE INDEX idx_10515573_idx_events2_type ON unpevents.events2 USING btree (type);


--
-- Name: idx_10515573_idx_events2_uuid; Type: INDEX; Schema: unpevents; Owner: unpevents
--

CREATE INDEX idx_10515573_idx_events2_uuid ON unpevents.events2 USING btree (uuid);


--
-- Name: idx_10515959_message_id; Type: INDEX; Schema: unpevents; Owner: unpevents
--

CREATE UNIQUE INDEX idx_10515959_message_id ON unpevents.messages_status USING btree (message_id);



--
-- PostgreSQL database dump complete
--
INSERT INTO unpevents.lock_events_sdp
(id, data_update, owner_lock, note)
VALUES(1, NULL, NULL, NULL);
