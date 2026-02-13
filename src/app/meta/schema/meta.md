# Meta Module Documentation

This document outlines the structure, architecture, and schema of the `Meta` module (`src/app/meta`).

## Overview

The Meta module manages authentication, user profiles, and role-based access (Personal vs. Team) for the application. It is designed to be self-contained with its own core services, guards, and routing.

## Architecture & Authentication

-   **Authentication**: Handled by **Supabase Auth**.
    -   **Email Storage**: Emails are stored strictly in `auth.users` (Supabase generic table). They are **NOT** duplicated in the `profiles` table to avoid data inconsistency.
    -   **Auth Service**: `MetaAuthService` manages sign-up, login, and session state.
-   **Profiles**:
    -   **Table**: `public.profiles` (PostgreSQL).
    -   **Linkage**: Linked to `auth.users` via `id` (UUID).
    -   **Auto-Creation**: A database trigger (`on_auth_user_created`) automatically inserts a row into `profiles` when a new user signs up in `auth.users`.
    -   **Profile Service**: `MetaProfileService` fetches profile data (username, role, phone) but **never** email.

## Directory Structure

```text
src/app/meta/
├── core/                       # Core services and guards (Singletons)
│   ├── auth/
│   │   ├── meta-auth.service.ts      <-- Supabase Auth logic (Login/Register)
│   │   ├── meta-profile.service.ts   <-- Profile Data (Fetch/Update)
│   ├── config/
│   │   └── meta-config.service.ts    <-- Environment config
│   ├── guards/
│   │   ├── meta-auth.guard.ts        <-- Proteces private usage
│   │   ├── meta-role.guard.ts        <-- Enforces role (Personal vs Team)
│   └── supabase/
│       └── supabase.client.ts        <-- Supabase client instance
│
├── interfaces/                 # TypeScript interfaces
│   ├── meta-auth-result.ts
│   ├── meta-role.ts
│   ├── meta-user-profile.ts    <-- Matches profiles table (No email)
│   └── meta-session.ts
│
├── auth/                       # Auth Pages
│   ├── login-meta/             <-- Login Component
│   └── register-meta/          <-- Registration Component
│
├── schema/                     # Database Schema & Documentation
│   ├── profiles.sql            <-- SQL definition for profiles table & triggers
│   └── meta.md                 <-- This file
│
├── public/                     # Public Layouts & Pages
│   ├── public-meta.routes.ts
│   ├── index/
│   └── template/
│
├── private/                    # Protected Layouts & Pages
│   ├── private-meta.routes.ts
│   ├── resolver/
│   └── pages/
│       ├── personal-meta/      <-- 'Personal' Role Dashboard
│       └── team-meta/          <-- 'Team' Role Dashboard
│
├── services/                   # Module-specific services
│   └── ui/                     <-- UI-related services
│
├── shared/                     # Shared components/pipes
│   └── ui/                     <-- Shared UI components
│
└── meta.routes.ts              # Main Module Routing
```

## Schema: `public.profiles`

The `profiles` table stores application-specific user data.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PK`, `FK -> auth.users.id` | Links to Supabase Auth User. |
| `username` | `text` | `UNIQUE`, `NOT NULL` | Unique public handle. |
| `role` | `text` | `CHECK (role in ('personal', 'team'))` | assigned role. |
| `phone`| `text` | `NULLABLE` | Optional contact number. |
| `created_at` | `timestamptz` | `DEFAULT now()` | Timestamp of creation. |

> **Note**: The `email` column is intentionally excluded from this table. Email is accessed via `MetaAuthService.user().email`.
