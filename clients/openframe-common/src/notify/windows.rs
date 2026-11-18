use std::path::{Path, PathBuf};

use ::windows::core::HSTRING;
use ::windows::Data::Xml::Dom::XmlDocument;
use ::windows::UI::Notifications::{
    NotificationData, NotificationUpdateResult, ToastNotification, ToastNotificationManager,
};
use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

use super::toast::{PROGRESS_STATUS_KEY, PROGRESS_VALUE_KEY};
use super::Error;

const CLASSES: &str = r"Software\Classes";
const ID_LIMIT: usize = 64;

#[derive(Debug, Clone, Copy)]
pub struct Tag<'a> {
    pub tag: &'a str,
    pub group: &'a str,
}

#[derive(Debug, Clone, Copy)]
pub struct Replace<'a> {
    pub tag: Tag<'a>,
    pub silently: bool,
}

#[derive(Debug, Clone, Copy)]
pub struct Progress<'a> {
    pub value: f64,
    pub status: &'a str,
}

#[derive(Debug)]
pub enum Shown {
    AsAsked,
    Untagged(Error),
    NotSilenced(Error),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Updated {
    Applied,
    NotFound,
}

pub struct AppId<'a> {
    pub id: &'a str,
    pub display_name: &'a str,
    pub icon: Option<&'a Path>,
    pub icon_background: Option<&'a str>,
    pub custom_activator: Option<&'a str>,
}

impl From<::windows::core::Error> for Error {
    fn from(err: ::windows::core::Error) -> Self {
        Error::Os(err.to_string())
    }
}

pub fn show(
    app_id: &str,
    xml: &str,
    replace: Option<Replace>,
    progress: Option<Progress>,
) -> Result<Shown, Error> {
    let document = XmlDocument::new()?;
    document.LoadXml(&HSTRING::from(xml))?;
    let toast = ToastNotification::CreateToastNotification(&document)?;
    let shown = match replace {
        None => Shown::AsAsked,
        Some(replace) => match set_tag(&toast, replace.tag) {
            Err(err) => Shown::Untagged(err),
            Ok(()) if replace.silently => match toast.SetSuppressPopup(true) {
                Ok(()) => Shown::AsAsked,
                Err(err) => Shown::NotSilenced(err.into()),
            },
            Ok(()) => Shown::AsAsked,
        },
    };
    if let Some(progress) = progress {
        toast.SetData(&progress_data(progress, 1)?)?;
    }
    ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(app_id))?.Show(&toast)?;
    Ok(shown)
}

pub fn update_progress(
    app_id: &str,
    tag: Tag,
    sequence: u32,
    progress: Progress,
) -> Result<Updated, Error> {
    let result = ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(app_id))?
        .UpdateWithTagAndGroup(
            &progress_data(progress, sequence)?,
            &HSTRING::from(clamp(tag.tag)),
            &HSTRING::from(clamp(tag.group)),
        )?;
    if result == NotificationUpdateResult::Succeeded {
        Ok(Updated::Applied)
    } else if result == NotificationUpdateResult::NotificationNotFound {
        Ok(Updated::NotFound)
    } else {
        Err(Error::Os(format!("toast update failed ({})", result.0)))
    }
}

pub fn remove(app_id: &str, tag: Tag) -> Result<(), Error> {
    ToastNotificationManager::History()?.RemoveGroupedTagWithId(
        &HSTRING::from(clamp(tag.tag)),
        &HSTRING::from(clamp(tag.group)),
        &HSTRING::from(app_id),
    )?;
    Ok(())
}

pub fn register_app_id(app: &AppId) -> Result<(), Error> {
    register_app_id_in(CLASSES, app)
}

pub fn ensure_icon(dir: &Path, file_name: &str, bytes: &[u8]) -> Result<PathBuf, Error> {
    let path = dir.join(file_name);
    if std::fs::read(&path).is_ok_and(|existing| existing == bytes) {
        return Ok(path);
    }
    std::fs::create_dir_all(dir)?;
    let tmp = path.with_extension(format!("{}.tmp", std::process::id()));
    std::fs::write(&tmp, bytes)
        .and_then(|()| std::fs::rename(&tmp, &path))
        .inspect_err(|_| {
            let _ = std::fs::remove_file(&tmp);
        })?;
    Ok(path)
}

fn register_app_id_in(classes: &str, app: &AppId) -> Result<(), Error> {
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(format!(r"{classes}\AppUserModelId\{}", app.id))?;
    let _ = key.set_value("DisplayName", &app.display_name);
    if let Some(icon) = app.icon {
        let _ = key.set_value("IconUri", &icon.display().to_string());
    }
    if let Some(color) = app.icon_background {
        let _ = key.set_value("IconBackgroundColor", &color);
    }
    if let Some(clsid) = app.custom_activator {
        key.set_value("CustomActivator", &clsid)?;
    }
    Ok(())
}

fn set_tag(toast: &ToastNotification, tag: Tag) -> Result<(), Error> {
    toast.SetTag(&HSTRING::from(clamp(tag.tag)))?;
    toast.SetGroup(&HSTRING::from(clamp(tag.group)))?;
    Ok(())
}

fn progress_data(progress: Progress, sequence: u32) -> Result<NotificationData, Error> {
    let data = NotificationData::new()?;
    let values = data.Values()?;
    values.Insert(
        &HSTRING::from(PROGRESS_VALUE_KEY),
        &HSTRING::from(format!("{:.3}", progress.value)),
    )?;
    values.Insert(
        &HSTRING::from(PROGRESS_STATUS_KEY),
        &HSTRING::from(progress.status),
    )?;
    data.SetSequenceNumber(sequence)?;
    Ok(data)
}

fn clamp(id: &str) -> String {
    id.chars().take(ID_LIMIT).collect()
}

#[cfg(test)]
#[path = "windows_tests.rs"]
mod tests;
