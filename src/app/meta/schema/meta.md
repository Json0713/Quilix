

src/app/meta/
├── core/
│   ├── auth/
│   │   ├── meta-auth.service.ts      <-- Supabase login/register/logout/restore
│   │   
│   │
│   ├── config/
│   │   └── meta-config.service.ts    <-- Environment + Supabase URLs / keys
│   │
│   │
│   ├── guards/
│   │   ├── meta-auth.guard.ts        <-- AuthGuard for private routes
│   │   ├── meta-role.guard.ts        <-- RoleGuard for personal/team pages
│   │
│   ├── supabase/
│       ├── supabase.client.ts        <-- Supabase client provider
│
│   
│
├── interfaces/
│   ├── meta-auth-result.ts
│   ├── meta-role.ts
│   ├── meta-session.ts
│   └── meta-user-profile.ts
│
├── auth/
│   ├── login-meta/
│   │   ├── login-meta.ts
│   │   └── login-meta.html
│   └── register-meta/
│       ├── register-meta.ts
│       └── register-meta.html
│
├── public/
│   ├── index/
│   └── template/
│       ├── template.ts
│       └── template.html
│
├── private/
│   ├── pages/
│   │   ├── personal-meta/
│   │   │   ├── index/
│   │   │   ├── template/
│   │   │   └── personal-meta.routes.ts
│   │   └── team-meta/
│   │       ├── index/
│   │       ├── template/
│   │       └── team-meta.routes.ts
│   ├── private-meta.routes.ts
│
├── public-meta.routes.ts
└── meta.routes.ts
