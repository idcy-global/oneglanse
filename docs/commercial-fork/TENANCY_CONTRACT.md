# SaaS tenancy contract

Every authenticated workspace-scoped operation must enforce on the server:

1. The user is authenticated.
2. The session has an active `activeOrganizationId`.
3. The user is a member of that Organization.
4. The requested Workspace has `workspace.tenantId === activeOrganizationId`.
5. The user has an active `workspaceMembers` record.
6. Owner-only mutations additionally verify the Workspace role.

Organization is the SaaS tenant and future billing boundary.
Workspace is the brand/project boundary.

Client-supplied Workspace IDs, Organization IDs, URL/query values, local-storage values, and hidden UI controls are never authorization.

Critical regression case: a user may legitimately belong to multiple Organizations and multiple Workspaces. Membership in Workspace B must not authorize Workspace B while Organization A is the active Organization.
