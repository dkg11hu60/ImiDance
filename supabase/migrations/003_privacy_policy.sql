-- Migration: 003_privacy_policy.sql
-- Description: Adds privacy policy acceptance columns to profiles table to enable GDPR compliance logging

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_accepted_ip TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_accepted_version INTEGER DEFAULT 0;
