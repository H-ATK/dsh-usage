# Security

This plugin is a local DSH bundle. It does not call a model, does not append chat messages, and does not send conversation content to third parties.

- The card reads the account balance through the existing DSH DeepSeek account RPC.
- The usage projection is computed from local Session events.
- No API keys or credentials are read by the plugin code, and none are stored by it.
- The client keeps switch state and a small card-state cache in `localStorage`.

To report a security issue, open a private advisory or contact the repository owner via GitHub. Please do not post account credentials, API keys, or private conversation logs in a public issue.
