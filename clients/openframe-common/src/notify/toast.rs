pub(crate) const PROGRESS_VALUE_KEY: &str = "progressValue";
pub(crate) const PROGRESS_STATUS_KEY: &str = "progressStatus";

pub struct Toast<'a> {
    pub launch: &'a str,
    pub title: &'a str,
    pub body: &'a str,
    pub scenario: Scenario,
    pub button_style: bool,
    pub progress: bool,
    pub input: Option<Input<'a>>,
    pub actions: &'a [Action<'a>],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scenario {
    Short,
    Reminder,
}

pub struct Input<'a> {
    pub id: &'a str,
    pub placeholder: &'a str,
}

pub struct Action<'a> {
    pub content: &'a str,
    pub activation: Activation,
    pub arguments: &'a str,
    pub hint: Option<Hint<'a>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Activation {
    Protocol,
    Background,
}

pub enum Hint<'a> {
    ButtonStyle(ButtonStyle),
    InputId(&'a str),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ButtonStyle {
    Success,
    Critical,
}

impl Toast<'_> {
    pub fn render(&self) -> String {
        let scenario = match self.scenario {
            Scenario::Short => r#" duration="short""#,
            Scenario::Reminder => r#" scenario="reminder""#,
        };
        let button_style = if self.button_style {
            r#" useButtonStyle="true""#
        } else {
            ""
        };
        let body = if self.body.is_empty() {
            String::new()
        } else {
            format!("<text>{}</text>", escape_xml(self.body))
        };
        let progress = if self.progress {
            format!(
                r#"<progress value="{{{PROGRESS_VALUE_KEY}}}" status="{{{PROGRESS_STATUS_KEY}}}"/>"#
            )
        } else {
            String::new()
        };
        let input = match &self.input {
            Some(input) => format!(
                r#"<input id="{}" type="text" placeHolderContent="{}"/>"#,
                escape_xml(input.id),
                escape_xml(input.placeholder)
            ),
            None => String::new(),
        };
        let actions: String = self.actions.iter().map(Action::render).collect();
        format!(
            r#"<toast{scenario} activationType="protocol" launch="{launch}"{button_style}>
    <visual><binding template="ToastGeneric"><text>{title}</text>{body}{progress}</binding></visual>
    <audio silent="true"/>
    <actions>{input}{actions}</actions>
</toast>"#,
            launch = escape_xml(self.launch),
            title = escape_xml(self.title),
        )
    }
}

impl Action<'_> {
    fn render(&self) -> String {
        let activation = match self.activation {
            Activation::Protocol => "protocol",
            Activation::Background => "background",
        };
        let hint = match &self.hint {
            None => String::new(),
            Some(Hint::ButtonStyle(ButtonStyle::Success)) => {
                r#" hint-buttonStyle="Success""#.to_string()
            }
            Some(Hint::ButtonStyle(ButtonStyle::Critical)) => {
                r#" hint-buttonStyle="Critical""#.to_string()
            }
            Some(Hint::InputId(id)) => format!(r#" hint-inputId="{}""#, escape_xml(id)),
        };
        format!(
            r#"<action content="{}" activationType="{activation}" arguments="{}"{hint}/>"#,
            escape_xml(self.content),
            escape_xml(self.arguments)
        )
    }
}

fn escape_xml(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            c if c < '\x20' && !matches!(c, '\t' | '\n' | '\r') => out.push(' '),
            _ => out.push(c),
        }
    }
    out
}

#[cfg(test)]
#[path = "toast_tests.rs"]
mod tests;
