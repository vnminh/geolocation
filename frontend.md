# Frontend Specification (React) for LLM Scaffolding

## Goal
Build a React frontend with a clear modular structure where:
- `src/routes/` only contains route placeholder components and route wiring.
- Real page implementation lives in `src/features/`.
- Each feature module has:
	- `page/` for detailed page components
	- `hook/` for custom hooks
	- `dto/` for request/response schemas (TypeScript types/interfaces)

This document is intended to be used as prompt/context for an LLM to generate code consistently.

## Tech Stack
- React + TypeScript
- React Router (v6+)
- Use fetch for API calls
- Optional state management: React Context only (keep simple)
- Styling: any (CSS modules/Tailwind/plain CSS), but keep folder conventions unchanged

## Required Routes
- `/signin`
- `/signup`
- `/user/settings`
- `/user/tagging`
- `/user/upsert-request` (admin only)

## High-Level Architecture
- `src/routes/*`:
	- Minimal wrapper pages, mostly mounting feature pages
	- Route guards and placeholders only
- `src/features/*`:
	- Business logic, UI, hooks, data contracts
- `src/shared/*`:
	- Reusable UI components, API client, auth utilities, constants

## Target Folder Structure
Use this structure exactly.

```txt
src/
	app/
		App.tsx
		router.tsx
		providers.tsx
	routes/
		signin/
			SigninRoute.tsx
		signup/
			SignupRoute.tsx
		user/
			settings/
				UserSettingsRoute.tsx
			tagging/
				UserTaggingRoute.tsx
			upsert-request/
				UserUpsertRequestRoute.tsx
	features/
		signin/
			page/
				SigninPage.tsx
			hook/
				useSigninForm.ts
				useSignin.ts
			dto/
				signin.dto.ts
		signup/
			page/
				SignupPage.tsx
			hook/
				useSignupForm.ts
				useSignup.ts
			dto/
				signup.dto.ts
		settings/
			page/
				UserSettingsPage.tsx
			hook/
				useUserSettings.ts
			dto/
				settings.dto.ts
		tagging/
			page/
				UserTaggingPage.tsx
			hook/
				usePredictionUpload.ts
				usePredictionStream.ts
			dto/
				tagging.dto.ts
		upsert-request/
			page/
				UserUpsertRequestPage.tsx
			hook/
				useUpsertRequestList.ts
				useUpdateUpsertRequestStatus.ts
			dto/
				upsert-request.dto.ts
	shared/
		api/
			client.ts
			endpoints.ts
		auth/
			token.ts
			role.ts
			guards.tsx
		components/
			layout/
				AppShell.tsx
			feedback/
				Loading.tsx
				ErrorState.tsx
		types/
			envelope.ts
		constants/
			routePaths.ts
	main.tsx
```

## Route Layer Rules
Each file in `src/routes/` should:
- Be thin.
- Import and render the matching feature page.
- Optionally apply guard wrappers.
- Avoid API calls and business logic.

Example rule:
- `src/routes/signin/SigninRoute.tsx` only renders `SigninPage`.
- `src/routes/user/upsert-request/UserUpsertRequestRoute.tsx` applies admin guard, then renders `UserUpsertRequestPage`.

## Feature Layer Rules
Each feature module must contain `page/`, `hook/`, `dto/`.

1. `page/`
- Holds page-level UI and composition.
- Uses hooks from `hook/`.
- Should not define raw API request logic inline.

2. `hook/`
- Holds feature-specific logic.
- Handles API calls, loading/error state, derived data.
- Return clean API to page components.

3. `dto/`
- Holds TypeScript interfaces/types for request and response payloads.
- Keep naming explicit:
	- `SigninRequest`, `SigninResponse`
	- `PredictionStreamEvent`, etc.

## Route Map and Ownership
1. `/signin`
- Route component: `routes/signin/SigninRoute.tsx`
- Feature page: `features/signin/page/SigninPage.tsx`

2. `/signup`
- Route component: `routes/signup/SignupRoute.tsx`
- Feature page: `features/signup/page/SignupPage.tsx`

3. `/user/settings`
- Route component: `routes/user/settings/UserSettingsRoute.tsx`
- Feature page: `features/settings/page/UserSettingsPage.tsx`

4. `/user/tagging`
- Route component: `routes/user/tagging/UserTaggingRoute.tsx`
- Feature page: `features/tagging/page/UserTaggingPage.tsx`

5. `/user/upsert-request` (admin only)
- Route component: `routes/user/upsert-request/UserUpsertRequestRoute.tsx`
- Feature page: `features/upsert-request/page/UserUpsertRequestPage.tsx`
- Must enforce admin-only access guard.

## Auth and Role Guard Requirements
Implement two guards in `shared/auth/guards.tsx`:
- `RequireAuth`: redirect to `/signin` when no token.
- `RequireRole`: accepts allowed roles, redirect non-authorized users to `/user/tagging` (or unauthorized page).

`/user/upsert-request` must be wrapped with:
- `RequireAuth`
- `RequireRole` with `admin` role only

## DTO Conventions
Use common API envelope type:

```ts
export interface ApiEnvelope<T> {
	success: boolean;
	data: T;
}
```

Feature DTO examples:
- `signin.dto.ts`
	- `SigninRequest`: `{ email: string; password: string }`
	- `SigninResponse`: `{ id: number; name: string; role: "user" | "admin" }`
- `signup.dto.ts`
	- `SignupRequest`: `{ email: string; name: string; password: string; role: "user" | "admin" }`
	- `SignupResponse`: `{ id: number; name: string; role: "user" | "admin" }`
- `tagging.dto.ts`
	- `PredictionAnswer`
	- `PredictionData`
	- `PredictionResponse`
	- `PredictionStreamEvent` union for SSE events: `start | stage | token | final | done | error`
- `upsert-request.dto.ts`
	- request list row type
	- update status request type

## API Integration Requirements
Create centralized API client in `shared/api/client.ts`:
- Base URL from env variable
- Request interceptor to attach auth token
- Response error normalization helper

Create endpoint constants in `shared/api/endpoints.ts`:
- `SIGNIN = "/user/signin"`
- `SIGNUP = "/user/signup"`
- `PREDICTION = "/prediction"`
- `PREDICTION_STREAM = "/prediction/stream"`
- `UPSERT_REQUEST = "/request"`

## Tagging Page UX Requirements
`features/tagging/page/UserTaggingPage.tsx` must support:
- Image upload and preview
- Trigger prediction stream endpoint
- Real-time stage display from stream events:
	- retrieval started/completed
	- predict started/completed
- Token-by-token text rendering from `token` event
- Final coordinate card from `final` event
- Error state when stream emits `error`

Hooks to implement:
- `usePredictionUpload`:
	- handles file input and validation
- `usePredictionStream`:
	- sends `POST /prediction/stream`
	- parses SSE event chunks
	- exposes stream state and callbacks

## Upsert Request (Admin) Requirements
`features/upsert-request/page/UserUpsertRequestPage.tsx` must include:
- List/table of requests
- Status update action (`decline`, `reviewing`, `accepted`)
- Loading and optimistic UI handling
- Access denied fallback if role is not admin

## App Router Requirements
In `app/router.tsx`:
- Define all required paths
- Group `/user/*` under auth guard
- Place `/user/upsert-request` under both auth and admin guard
- Add fallback route (`*`) to redirect to `/signin` or `/user/tagging` based on auth

## Naming and Code Style
- Use PascalCase for components
- Use camelCase for hooks and variables
- Prefix hooks with `use`
- Keep each file focused on one concern
- Avoid large monolithic files

## Note
When generating code from this spec, produce:
1. All folders/files in the structure above
2. Minimal working route placeholders in `routes/`
3. Full page skeletons in `features/*/page`
4. Hooks and DTOs for each feature
5. Router with auth and admin role guards
6. Tagging stream UI flow wired to `/prediction/stream`

## Non-Goals
- Do not place detailed page implementation directly in `routes/`
- Do not put DTO definitions in page components
- Do not mix admin-only logic into non-admin feature modules
