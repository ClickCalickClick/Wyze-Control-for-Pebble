module.exports = function createClayConfig(statusHtml) {
  return [
    {
      "type": "heading",
      "defaultValue": "Wyze Control Settings"
    },
    {
      "type": "text",
      "defaultValue": statusHtml || ""
    },
    {
      "type": "text",
      "defaultValue": "Generate an API Key and Key ID via the <a href='https://developer-api-console.wyze.com/' target='_blank'>Wyze Developer Console</a>."
    },
    {
      "type": "text",
      "defaultValue": "<b>Security Notice:</b> Wyze does not provide an OAuth login page. Therefore, to connect, we must briefly handle your Wyze Email and Password. <br><br><b>Your password is NEVER stored permanently.</b> Once you click Save, your phone securely exchanges your password for Wyze Auth Tokens, and your password is immediately deleted from your phone's storage. It is never sent to any 3rd-party servers, only directly to Wyze."
    },
    {
      "type": "section",
      "items": [
        {
          "type": "heading",
          "defaultValue": "Wyze Credentials"
        },
        {
          "type": "input",
          "messageKey": "WyzeEmail",
          "defaultValue": "",
          "label": "Wyze Account Email"
        },
        {
          "type": "input",
          "messageKey": "WyzePassword",
          "defaultValue": "",
          "label": "Wyze Password",
          "attributes": {
            "type": "password"
          }
        },
        {
          "type": "input",
          "messageKey": "WyzeKeyID",
          "defaultValue": "",
          "label": "Wyze Key ID"
        },
        {
          "type": "input",
          "messageKey": "WyzeAPIKey",
          "defaultValue": "",
          "label": "Wyze API Key"
        }
      ]
    },
    {
      "type": "submit",
      "defaultValue": "Save Settings"
    },
    {
      "type": "section",
      "items": [
        {
          "type": "heading",
          "defaultValue": "Account"
        },
        {
          "type": "toggle",
          "messageKey": "WyzeLogout",
          "defaultValue": false,
          "label": "Log Out of Wyze",
          "description": "Enable and Save to log out. Clears all tokens from this phone."
        }
      ]
    }
  ];
};
