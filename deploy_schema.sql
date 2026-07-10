--
-- PostgreSQL database dump
--

\restrict cjRj7uG6kcpMebr8hd2S3BsJqGUzzSeq7bvfgrYaSrmWeFw6ZdwTLJVMYUd1ZH8

-- Dumped from database version 17.8 (a284a84)
-- Dumped by pg_dump version 17.9 (Ubuntu 17.9-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_account (
    id integer NOT NULL,
    password_hash text NOT NULL,
    mobile_number text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    business_id uuid NOT NULL
);


--
-- Name: admin_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_account_id_seq OWNED BY public.admin_account.id;


--
-- Name: admin_login_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_login_logs (
    id integer NOT NULL,
    success boolean NOT NULL,
    admin_id integer,
    ip_address text,
    user_agent text,
    created_at timestamp without time zone DEFAULT now(),
    business_id uuid NOT NULL
);


--
-- Name: admin_login_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_login_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_login_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_login_logs_id_seq OWNED BY public.admin_login_logs.id;


--
-- Name: business_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_settings (
    id integer DEFAULT 1 NOT NULL,
    restaurant_name text NOT NULL,
    gstin character varying(20),
    address text,
    phone character varying(15),
    email text,
    is_gst_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    cgst_rate numeric(5,2) DEFAULT 2.5 NOT NULL,
    sgst_rate numeric(5,2) DEFAULT 2.5 NOT NULL,
    kitchen_pin character varying(6) DEFAULT '1234'::character varying,
    business_id uuid NOT NULL,
    CONSTRAINT business_settings_id_check CHECK ((id = 1))
);


--
-- Name: businesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.businesses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(50) NOT NULL,
    logo_url text,
    subscription_tier character varying(20) DEFAULT 'free'::character varying,
    features jsonb DEFAULT '{"pos_system": true, "kitchen_display": true, "manual_table_orders": true, "qr_digital_ordering": true}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    code text NOT NULL,
    discount_type text NOT NULL,
    value numeric(10,2) NOT NULL,
    expiry_date date,
    active boolean DEFAULT true NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    usage_limit integer DEFAULT 1 NOT NULL,
    used_count integer DEFAULT 0 NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    business_id uuid NOT NULL,
    CONSTRAINT coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percent'::text, 'flat'::text])))
);


--
-- Name: gallery_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gallery_images (
    id integer NOT NULL,
    image_url text NOT NULL,
    alt_text character varying(200) DEFAULT ''::character varying,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    business_id uuid NOT NULL
);


--
-- Name: gallery_images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gallery_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gallery_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gallery_images_id_seq OWNED BY public.gallery_images.id;


--
-- Name: hero_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hero_content (
    id integer DEFAULT 1 NOT NULL,
    location_tag text DEFAULT '🧇 k, Pune'::text NOT NULL,
    title text DEFAULT 'Fresh <span>Belgian Waffles</span> in k'::text NOT NULL,
    description text DEFAULT 'Crispy outside. Fluffy inside. Made fresh every time. Experience authentic Belgian waffle culture at Henny''s Gourmet.'::text NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    business_id uuid NOT NULL,
    CONSTRAINT hero_content_single_row CHECK ((id = 1))
);


--
-- Name: location_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.location_content (
    id integer DEFAULT 1 NOT NULL,
    address text DEFAULT 'Koregaon Park, Pune, Maharashtra 411001'::text NOT NULL,
    phone text DEFAULT '+91 98765 43210'::text NOT NULL,
    instagram_handle text DEFAULT '@hennysgourmet'::text NOT NULL,
    instagram_url text DEFAULT 'https://www.instagram.com/hennysgourmet'::text NOT NULL,
    map_embed_url text DEFAULT 'https://www.google.com/maps?q=18.53870,73.90027&z=17&output=embed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    open_time time without time zone DEFAULT '18:00:00'::time without time zone NOT NULL,
    close_time time without time zone DEFAULT '23:00:00'::time without time zone NOT NULL,
    closed_day integer DEFAULT 1 NOT NULL,
    opening_hours_display text,
    business_id uuid NOT NULL,
    CONSTRAINT location_content_single_row CHECK ((id = 1))
);


--
-- Name: menu_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    business_id uuid NOT NULL
);


--
-- Name: menu_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menu_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menu_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menu_categories_id_seq OWNED BY public.menu_categories.id;


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_items (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(120) NOT NULL,
    description text NOT NULL,
    price numeric(10,2) NOT NULL,
    price_label character varying(20) NOT NULL,
    image_url text,
    available boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category_id integer NOT NULL,
    business_id uuid NOT NULL
);


--
-- Name: menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menu_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    price numeric(10,2) NOT NULL,
    price_label character varying(20) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    image text NOT NULL,
    menu_item_id integer NOT NULL,
    business_id uuid NOT NULL
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token integer NOT NULL,
    customer_name character varying(100) NOT NULL,
    customer_phone character varying(15) NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    payment_method character varying(10) NOT NULL,
    payment_status character varying(10) DEFAULT 'pending'::character varying NOT NULL,
    status character varying(50) DEFAULT 'new'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    coupon_code text,
    discount numeric(10,2) DEFAULT 0 NOT NULL,
    paid_amount numeric DEFAULT 0,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    cgst numeric(10,2) DEFAULT 0 NOT NULL,
    sgst numeric(10,2) DEFAULT 0 NOT NULL,
    gst_total numeric(10,2) DEFAULT 0 NOT NULL,
    gst_rate numeric(5,4) DEFAULT 0.05 NOT NULL,
    order_type character varying(20) DEFAULT 'dine-in'::character varying,
    special_instructions text DEFAULT ''::text,
    order_source character varying(20) DEFAULT 'counter'::character varying,
    table_session_id uuid,
    business_id uuid NOT NULL,
    CONSTRAINT orders_order_source_check CHECK (((order_source)::text = ANY ((ARRAY['counter'::character varying, 'table'::character varying])::text[]))),
    CONSTRAINT orders_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['counter'::character varying, 'online'::character varying, 'cash'::character varying, 'upi'::character varying, 'card'::character varying, 'split'::character varying])::text[]))),
    CONSTRAINT orders_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying])::text[]))),
    CONSTRAINT orders_status_check CHECK (((status)::text = ANY (ARRAY[('approval_pending'::character varying)::text, ('new'::character varying)::text, ('preparing'::character varying)::text, ('ready'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text])))
);


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id integer NOT NULL,
    message text NOT NULL,
    bg_color character varying(30) DEFAULT '#f59e0b'::character varying,
    text_color character varying(30) DEFAULT '#ffffff'::character varying,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    business_id uuid NOT NULL
);


--
-- Name: promotions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promotions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promotions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promotions_id_seq OWNED BY public.promotions.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    item_name character varying(100) NOT NULL,
    reviewer_name character varying(100) NOT NULL,
    rating integer NOT NULL,
    review_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    menu_item_id integer,
    business_id uuid NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    pin_hash character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    phone character varying(20),
    business_id uuid NOT NULL,
    CONSTRAINT staff_role_check CHECK (((role)::text = ANY ((ARRAY['manager'::character varying, 'waiter'::character varying, 'kitchen'::character varying])::text[])))
);


--
-- Name: super_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.super_admins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: table_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_id uuid,
    customer_name character varying(100) NOT NULL,
    customer_phone character varying(15) NOT NULL,
    otp character varying(10),
    is_verified boolean DEFAULT false,
    status character varying(20) DEFAULT 'active'::character varying,
    start_time timestamp with time zone DEFAULT now(),
    end_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    business_id uuid NOT NULL,
    CONSTRAINT table_sessions_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'billing'::character varying, 'completed'::character varying])::text[])))
);


--
-- Name: tables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_number character varying(20) NOT NULL,
    qr_code character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'available'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    business_id uuid NOT NULL,
    CONSTRAINT tables_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'occupied'::character varying, 'reserved'::character varying])::text[])))
);


--
-- Name: token_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.token_counter (
    date date DEFAULT CURRENT_DATE NOT NULL,
    last_token integer DEFAULT 0 NOT NULL,
    business_id uuid NOT NULL
);


--
-- Name: admin_account id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_account ALTER COLUMN id SET DEFAULT nextval('public.admin_account_id_seq'::regclass);


--
-- Name: admin_login_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_login_logs ALTER COLUMN id SET DEFAULT nextval('public.admin_login_logs_id_seq'::regclass);


--
-- Name: gallery_images id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_images ALTER COLUMN id SET DEFAULT nextval('public.gallery_images_id_seq'::regclass);


--
-- Name: menu_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories ALTER COLUMN id SET DEFAULT nextval('public.menu_categories_id_seq'::regclass);


--
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: promotions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions ALTER COLUMN id SET DEFAULT nextval('public.promotions_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: admin_account admin_account_mobile_business_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_account
    ADD CONSTRAINT admin_account_mobile_business_unique UNIQUE (business_id, mobile_number);


--
-- Name: admin_account admin_account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_account
    ADD CONSTRAINT admin_account_pkey PRIMARY KEY (id);


--
-- Name: admin_login_logs admin_login_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_login_logs
    ADD CONSTRAINT admin_login_logs_pkey PRIMARY KEY (id);


--
-- Name: business_settings business_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_settings
    ADD CONSTRAINT business_settings_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_slug_key UNIQUE (slug);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (code);


--
-- Name: gallery_images gallery_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_images
    ADD CONSTRAINT gallery_images_pkey PRIMARY KEY (id);


--
-- Name: hero_content hero_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hero_content
    ADD CONSTRAINT hero_content_pkey PRIMARY KEY (id);


--
-- Name: location_content location_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_content
    ADD CONSTRAINT location_content_pkey PRIMARY KEY (id);


--
-- Name: menu_categories menu_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_name_key UNIQUE (name);


--
-- Name: menu_categories menu_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (id);


--
-- Name: menu_items menu_items_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_name_key UNIQUE (name);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: menu_items menu_items_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_slug_key UNIQUE (slug);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: staff staff_pin_hash_business_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pin_hash_business_unique UNIQUE (business_id, pin_hash);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: super_admins super_admins_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admins
    ADD CONSTRAINT super_admins_email_key UNIQUE (email);


--
-- Name: super_admins super_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admins
    ADD CONSTRAINT super_admins_pkey PRIMARY KEY (id);


--
-- Name: table_sessions table_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT table_sessions_pkey PRIMARY KEY (id);


--
-- Name: tables tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_pkey PRIMARY KEY (id);


--
-- Name: tables tables_qr_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_qr_code_key UNIQUE (qr_code);


--
-- Name: tables tables_table_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_table_number_key UNIQUE (table_number);


--
-- Name: token_counter token_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_counter
    ADD CONSTRAINT token_counter_pkey PRIMARY KEY (date);


--
-- Name: idx_coupons_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_active ON public.coupons USING btree (active);


--
-- Name: idx_coupons_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_expiry ON public.coupons USING btree (expiry_date);


--
-- Name: idx_gallery_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gallery_display_order ON public.gallery_images USING btree (display_order);


--
-- Name: idx_menu_items_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_available ON public.menu_items USING btree (available);


--
-- Name: idx_menu_items_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_category_id ON public.menu_items USING btree (category_id);


--
-- Name: idx_menu_items_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_sort ON public.menu_items USING btree (sort_order);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_created_at_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at_payment_status ON public.orders USING btree (created_at, payment_status);


--
-- Name: idx_orders_created_at_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at_status ON public.orders USING btree (created_at, status);


--
-- Name: idx_orders_customer_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_phone ON public.orders USING btree (customer_phone);


--
-- Name: idx_orders_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_payment_status ON public.orders USING btree (payment_status);


--
-- Name: idx_orders_phone_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_phone_created ON public.orders USING btree (customer_phone, created_at DESC);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_promotions_active_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promotions_active_expires ON public.promotions USING btree (active, expires_at DESC);


--
-- Name: idx_reviews_item_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_item_name ON public.reviews USING btree (item_name);


--
-- Name: idx_reviews_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_rating ON public.reviews USING btree (rating DESC);


--
-- Name: admin_account fk_admin_account_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_account
    ADD CONSTRAINT fk_admin_account_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: admin_login_logs fk_admin_login_logs_admin; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_login_logs
    ADD CONSTRAINT fk_admin_login_logs_admin FOREIGN KEY (admin_id) REFERENCES public.admin_account(id) ON DELETE SET NULL;


--
-- Name: admin_login_logs fk_admin_login_logs_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_login_logs
    ADD CONSTRAINT fk_admin_login_logs_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: business_settings fk_business_settings_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_settings
    ADD CONSTRAINT fk_business_settings_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: coupons fk_coupons_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT fk_coupons_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: gallery_images fk_gallery_images_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_images
    ADD CONSTRAINT fk_gallery_images_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: hero_content fk_hero_content_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hero_content
    ADD CONSTRAINT fk_hero_content_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: location_content fk_location_content_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_content
    ADD CONSTRAINT fk_location_content_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: menu_categories fk_menu_categories_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT fk_menu_categories_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: menu_items fk_menu_items_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT fk_menu_items_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: menu_items fk_menu_items_category; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT fk_menu_items_category FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE RESTRICT;


--
-- Name: order_items fk_order_items_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fk_order_items_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: order_items fk_order_items_menu_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fk_order_items_menu_item FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE RESTRICT;


--
-- Name: orders fk_orders_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fk_orders_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: orders fk_orders_coupon; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fk_orders_coupon FOREIGN KEY (coupon_code) REFERENCES public.coupons(code) ON DELETE SET NULL;


--
-- Name: promotions fk_promotions_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT fk_promotions_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: reviews fk_reviews_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fk_reviews_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: reviews fk_reviews_menu_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fk_reviews_menu_item FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: staff fk_staff_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT fk_staff_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: table_sessions fk_table_sessions_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT fk_table_sessions_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: tables fk_tables_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT fk_tables_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: token_counter fk_token_counter_business; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_counter
    ADD CONSTRAINT fk_token_counter_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_table_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_table_session_id_fkey FOREIGN KEY (table_session_id) REFERENCES public.table_sessions(id) ON DELETE SET NULL;


--
-- Name: table_sessions table_sessions_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT table_sessions_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

-- ==============================================================================
-- DEFAULT INIT DATA
-- ==============================================================================

-- 1. Create a default business
INSERT INTO public.businesses (id, name, slug, subscription_tier, is_active) 
VALUES ('00000000-0000-0000-0000-000000000001', 'The Chinese House', 'the-chinese-house', 'premium', true)
ON CONFLICT DO NOTHING;

-- 2. Create default business settings
INSERT INTO public.business_settings (id, business_id, restaurant_name, is_gst_enabled)
VALUES (1, '00000000-0000-0000-0000-000000000001', 'The Chinese House', false)
ON CONFLICT DO NOTHING;

-- 3. Create the Default Admin (Password: admin123)
INSERT INTO public.admin_account (business_id, mobile_number, password_hash) 
VALUES ('00000000-0000-0000-0000-000000000001', '0000000000', '$2b$10$S6JJ9IXNqI.nbQGituPeTuT2IOO8ztL3A.tdLbaCiYgqwN9Mdk39y')
ON CONFLICT DO NOTHING;

