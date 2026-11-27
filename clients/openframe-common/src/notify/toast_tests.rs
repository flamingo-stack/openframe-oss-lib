use super::*;

const CHAT_DIALOG_URI: &str = "openframe-chat://notify?kind=dialog&id=d1";
const CHAT_UPDATE_BODY_URI: &str = "openframe-chat://software-update?action=body&notice=%7B%7D";
const CHAT_UPDATE_NOW_URI: &str =
    "openframe-chat://software-update?action=update%2Dnow&notice=%7B%7D";
const CHAT_ASK_LATER_URI: &str =
    "openframe-chat://software-update?action=ask%2Dlater&notice=%7B%7D";
const CONSOLE_URI: &str =
    "openframe-console://notify?payload=%7B%22type%22%3A%22announcement%22%7D";

fn open(uri: &str) -> Action<'_> {
    Action {
        content: "Open",
        activation: Activation::Protocol,
        arguments: uri,
        hint: None,
    }
}

fn chat(title: &str, body: &str, uri: &str) -> String {
    Toast {
        launch: uri,
        title,
        body,
        scenario: Scenario::Short,
        button_style: false,
        progress: false,
        input: None,
        actions: &[open(uri)],
    }
    .render()
}

fn console(title: &str, body: &str, uri: &str, input: Option<Input>, actions: &[Action]) -> String {
    Toast {
        launch: uri,
        title,
        body,
        scenario: Scenario::Short,
        button_style: true,
        progress: false,
        input,
        actions,
    }
    .render()
}

fn chat_update(title: &str, body: &str, actions: &[Action], progress: bool) -> String {
    Toast {
        launch: CHAT_UPDATE_BODY_URI,
        title,
        body,
        scenario: Scenario::Reminder,
        button_style: false,
        progress,
        input: None,
        actions,
    }
    .render()
}

fn update_now() -> Action<'static> {
    Action {
        content: "Update now",
        activation: Activation::Protocol,
        arguments: CHAT_UPDATE_NOW_URI,
        hint: None,
    }
}

fn background<'a>(content: &'a str, arguments: &'a str, hint: Hint<'a>) -> Action<'a> {
    Action {
        content,
        activation: Activation::Background,
        arguments,
        hint: Some(hint),
    }
}

#[test]
fn renders_the_chat_message_toast_as_chat_posts_it() {
    assert_eq!(
        chat("New message", "Fae replied", CHAT_DIALOG_URI),
        CHAT_MESSAGE
    );
}

#[test]
fn leaves_out_an_empty_body() {
    assert_eq!(
        chat(
            "Ticket #42 updated",
            "",
            "openframe-chat://notify?kind=ticket&id=t42"
        ),
        CHAT_MESSAGE_NO_BODY
    );
}

#[test]
fn renders_the_chat_update_prompt_with_both_buttons() {
    let ask_later = Action {
        content: "Ask Later",
        activation: Activation::Protocol,
        arguments: CHAT_ASK_LATER_URI,
        hint: None,
    };
    assert_eq!(
        chat_update(
            "Google Chrome needs to close to update",
            "Flamingo & Co asks you to update <Chrome> by 29 Oct.",
            &[update_now(), ask_later],
            false,
        ),
        CHAT_UPDATE_PROMPT
    );
}

#[test]
fn renders_the_chat_update_countdown_with_its_progress_bar() {
    assert_eq!(
        chat_update(
            "Google Chrome will close in 5 minutes",
            "",
            &[update_now()],
            true
        ),
        CHAT_UPDATE_COUNTDOWN
    );
}

#[test]
fn renders_the_console_notification_as_console_posts_it() {
    assert_eq!(
        console(
            "Maintenance tonight",
            "Servers restart at 22:00 & take ~5 min",
            CONSOLE_URI,
            None,
            &[open(CONSOLE_URI)],
        ),
        CONSOLE_DEFAULT
    );
}

#[test]
fn renders_the_console_approval_with_styled_background_buttons() {
    let title = "Approve \"Restart IIS\"?";
    let approve = format!("action=approve&title={title}&user=u1&payload=%7B%7D");
    let reject = format!("action=reject&title={title}&user=u1&payload=%7B%7D");
    assert_eq!(
        console(
            title,
            "Requested by <admin> on 'web-01'",
            CONSOLE_URI,
            None,
            &[
                background("Approve", &approve, Hint::ButtonStyle(ButtonStyle::Success)),
                background("Reject", &reject, Hint::ButtonStyle(ButtonStyle::Critical)),
            ],
        ),
        CONSOLE_APPROVAL
    );
}

#[test]
fn renders_the_console_message_with_its_inline_reply() {
    let reply = Input {
        id: "reply",
        placeholder: "Reply to Mingo",
    };
    assert_eq!(
        console(
            "Mingo",
            "Done: 3 devices patched",
            CONSOLE_URI,
            Some(reply),
            &[
                background(
                    "Send",
                    "action=reply&title=Mingo&user=u1&payload=%7B%7D",
                    Hint::InputId("reply"),
                ),
                open(CONSOLE_URI),
            ],
        ),
        CONSOLE_MESSAGE
    );
}

#[test]
fn replaces_control_characters_xml_cannot_carry() {
    assert_eq!(
        console(
            "Tool output",
            "line\u{7}bell\ttab",
            CONSOLE_URI,
            None,
            &[open(CONSOLE_URI)],
        ),
        CONSOLE_CONTROL_CHARS
    );
}

#[test]
fn renders_text_truncated_by_the_caller() {
    let uri = "openframe-console://notify";
    assert_eq!(
        console(
            &crate::notify::truncate(&"T".repeat(60), 50),
            &crate::notify::truncate(&"x".repeat(400), 300),
            uri,
            None,
            &[open(uri)],
        ),
        CONSOLE_TRUNCATED
    );
}

const CHAT_MESSAGE: &str = r#"<toast duration="short" activationType="protocol" launch="openframe-chat://notify?kind=dialog&amp;id=d1">
    <visual><binding template="ToastGeneric"><text>New message</text><text>Fae replied</text></binding></visual>
    <audio silent="true"/>
    <actions><action content="Open" activationType="protocol" arguments="openframe-chat://notify?kind=dialog&amp;id=d1"/></actions>
</toast>"#;
const CHAT_MESSAGE_NO_BODY: &str = r#"<toast duration="short" activationType="protocol" launch="openframe-chat://notify?kind=ticket&amp;id=t42">
    <visual><binding template="ToastGeneric"><text>Ticket #42 updated</text></binding></visual>
    <audio silent="true"/>
    <actions><action content="Open" activationType="protocol" arguments="openframe-chat://notify?kind=ticket&amp;id=t42"/></actions>
</toast>"#;
const CHAT_UPDATE_PROMPT: &str = r#"<toast scenario="reminder" activationType="protocol" launch="openframe-chat://software-update?action=body&amp;notice=%7B%7D">
    <visual><binding template="ToastGeneric"><text>Google Chrome needs to close to update</text><text>Flamingo &amp; Co asks you to update &lt;Chrome&gt; by 29 Oct.</text></binding></visual>
    <audio silent="true"/>
    <actions><action content="Update now" activationType="protocol" arguments="openframe-chat://software-update?action=update%2Dnow&amp;notice=%7B%7D"/><action content="Ask Later" activationType="protocol" arguments="openframe-chat://software-update?action=ask%2Dlater&amp;notice=%7B%7D"/></actions>
</toast>"#;
const CHAT_UPDATE_COUNTDOWN: &str = r#"<toast scenario="reminder" activationType="protocol" launch="openframe-chat://software-update?action=body&amp;notice=%7B%7D">
    <visual><binding template="ToastGeneric"><text>Google Chrome will close in 5 minutes</text><progress value="{progressValue}" status="{progressStatus}"/></binding></visual>
    <audio silent="true"/>
    <actions><action content="Update now" activationType="protocol" arguments="openframe-chat://software-update?action=update%2Dnow&amp;notice=%7B%7D"/></actions>
</toast>"#;
const CONSOLE_DEFAULT: &str = r#"<toast duration="short" activationType="protocol" launch="openframe-console://notify?payload=%7B%22type%22%3A%22announcement%22%7D" useButtonStyle="true">
    <visual><binding template="ToastGeneric"><text>Maintenance tonight</text><text>Servers restart at 22:00 &amp; take ~5 min</text></binding></visual>
    <audio silent="true"/>
    <actions><action content="Open" activationType="protocol" arguments="openframe-console://notify?payload=%7B%22type%22%3A%22announcement%22%7D"/></actions>
</toast>"#;
const CONSOLE_APPROVAL: &str = r#"<toast duration="short" activationType="protocol" launch="openframe-console://notify?payload=%7B%22type%22%3A%22announcement%22%7D" useButtonStyle="true">
    <visual><binding template="ToastGeneric"><text>Approve &quot;Restart IIS&quot;?</text><text>Requested by &lt;admin&gt; on &apos;web-01&apos;</text></binding></visual>
    <audio silent="true"/>
    <actions><action content="Approve" activationType="background" arguments="action=approve&amp;title=Approve &quot;Restart IIS&quot;?&amp;user=u1&amp;payload=%7B%7D" hint-buttonStyle="Success"/><action content="Reject" activationType="background" arguments="action=reject&amp;title=Approve &quot;Restart IIS&quot;?&amp;user=u1&amp;payload=%7B%7D" hint-buttonStyle="Critical"/></actions>
</toast>"#;
const CONSOLE_MESSAGE: &str = r#"<toast duration="short" activationType="protocol" launch="openframe-console://notify?payload=%7B%22type%22%3A%22announcement%22%7D" useButtonStyle="true">
    <visual><binding template="ToastGeneric"><text>Mingo</text><text>Done: 3 devices patched</text></binding></visual>
    <audio silent="true"/>
    <actions><input id="reply" type="text" placeHolderContent="Reply to Mingo"/><action content="Send" activationType="background" arguments="action=reply&amp;title=Mingo&amp;user=u1&amp;payload=%7B%7D" hint-inputId="reply"/><action content="Open" activationType="protocol" arguments="openframe-console://notify?payload=%7B%22type%22%3A%22announcement%22%7D"/></actions>
</toast>"#;
const CONSOLE_CONTROL_CHARS: &str = r#"<toast duration="short" activationType="protocol" launch="openframe-console://notify?payload=%7B%22type%22%3A%22announcement%22%7D" useButtonStyle="true">
    <visual><binding template="ToastGeneric"><text>Tool output</text><text>line bell	tab</text></binding></visual>
    <audio silent="true"/>
    <actions><action content="Open" activationType="protocol" arguments="openframe-console://notify?payload=%7B%22type%22%3A%22announcement%22%7D"/></actions>
</toast>"#;
const CONSOLE_TRUNCATED: &str = r#"<toast duration="short" activationType="protocol" launch="openframe-console://notify" useButtonStyle="true">
    <visual><binding template="ToastGeneric"><text>TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT…</text><text>xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx…</text></binding></visual>
    <audio silent="true"/>
    <actions><action content="Open" activationType="protocol" arguments="openframe-console://notify"/></actions>
</toast>"#;
