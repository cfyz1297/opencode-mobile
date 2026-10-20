// The offline demo screen's permission-reply type. The demo is a fully
// scripted walkthrough that never touches real sessions or the network
// (app/demo.tsx). The analytics prop builders that shared this module were
// dropped together with analytics.

/** Mirrors PermissionPrompt's `onReply` reply values (see
 *  src/components/chat/PermissionPrompt.tsx). */
export type DemoPermissionReply = "once" | "always" | "reject"
