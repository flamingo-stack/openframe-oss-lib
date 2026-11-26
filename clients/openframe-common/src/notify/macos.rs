use std::ptr::NonNull;
use std::sync::OnceLock;

use block2::{DynBlock, RcBlock};
use objc2::rc::Retained;
use objc2::runtime::{AnyObject, Bool, ProtocolObject};
use objc2::{define_class, msg_send, AnyThread, DefinedClass, Message};
use objc2_foundation::{
    NSArray, NSBundle, NSDictionary, NSError, NSObject, NSObjectProtocol, NSSet, NSString,
};
use objc2_user_notifications::{
    UNAuthorizationOptions, UNMutableNotificationContent, UNNotification, UNNotificationAction,
    UNNotificationActionOptions, UNNotificationCategory, UNNotificationCategoryOptions,
    UNNotificationPresentationOptions, UNNotificationRequest, UNNotificationResponse,
    UNTextInputNotificationAction, UNTextInputNotificationResponse, UNUserNotificationCenter,
    UNUserNotificationCenterDelegate,
};

use super::Error;

pub struct Category<'a> {
    pub id: &'a str,
    pub actions: &'a [Action<'a>],
}

pub struct Action<'a> {
    pub id: &'a str,
    pub title: &'a str,
    pub style: ActionStyle,
    pub text_input: Option<TextInput<'a>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActionStyle {
    Foreground,
    Background,
    AuthenticationRequired,
    Destructive,
}

pub struct TextInput<'a> {
    pub button: &'a str,
    pub placeholder: &'a str,
}

pub struct Notification<'a> {
    pub id: &'a str,
    pub title: &'a str,
    pub body: &'a str,
    pub category: &'a str,
    pub thread: Option<&'a str>,
    pub user_info: &'a [(&'a str, &'a str)],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Presentation {
    Banner,
    BannerAndList,
}

pub struct Delivered(Retained<UNNotification>);

impl Delivered {
    pub fn category(&self) -> String {
        self.0.request().content().categoryIdentifier().to_string()
    }

    pub fn title(&self) -> String {
        self.0.request().content().title().to_string()
    }

    pub fn user_info(&self, key: &str) -> Option<String> {
        let user_info = self.0.request().content().userInfo();
        let key = NSString::from_str(key);
        let key: &AnyObject = &key;
        let value = user_info.objectForKey(key)?;
        Some(value.downcast_ref::<NSString>()?.to_string())
    }
}

pub struct Response<'a>(&'a UNNotificationResponse);

impl Response<'_> {
    pub fn action(&self) -> String {
        self.0.actionIdentifier().to_string()
    }

    pub fn text(&self) -> Option<String> {
        let input = self.0.downcast_ref::<UNTextInputNotificationResponse>()?;
        Some(input.userText().to_string())
    }

    pub fn notification(&self) -> Delivered {
        Delivered(self.0.notification())
    }
}

type Present = Box<dyn Fn(&Delivered) -> Presentation + Send + Sync>;
type Respond = Box<dyn Fn(&Response) + Send + Sync>;

struct Handlers {
    present: Present,
    respond: Respond,
}

static DELEGATE: OnceLock<Retained<NotificationDelegate>> = OnceLock::new();

pub fn install(
    categories: &[Category],
    present: impl Fn(&Delivered) -> Presentation + Send + Sync + 'static,
    respond: impl Fn(&Response) + Send + Sync + 'static,
) -> Result<(), Error> {
    if NSBundle::mainBundle().bundleIdentifier().is_none() {
        return Err(Error::Unavailable);
    }
    let delegate = NotificationDelegate::new(Handlers {
        present: Box::new(present),
        respond: Box::new(respond),
    });
    DELEGATE
        .set(delegate.clone())
        .map_err(|_| Error::AlreadyInstalled)?;
    let center = UNUserNotificationCenter::currentNotificationCenter();
    center.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
    let categories: Vec<Retained<UNNotificationCategory>> =
        categories.iter().map(category).collect();
    center.setNotificationCategories(&NSSet::from_retained_slice(&categories));
    Ok(())
}

pub fn request_authorization(
    done: impl Fn(Result<bool, Error>) + Send + Sync + 'static,
) -> Result<(), Error> {
    center()?.requestAuthorizationWithOptions_completionHandler(
        UNAuthorizationOptions::Alert | UNAuthorizationOptions::Sound,
        &RcBlock::new(move |granted: Bool, error: *mut NSError| {
            done(match os_error(error) {
                Some(err) => Err(err),
                None => Ok(granted.as_bool()),
            })
        }),
    );
    Ok(())
}

pub fn post(
    notification: &Notification,
    done: impl Fn(Result<(), Error>) + Send + Sync + 'static,
) -> Result<(), Error> {
    let center = center()?;
    let content = UNMutableNotificationContent::new();
    content.setTitle(&NSString::from_str(notification.title));
    if !notification.body.is_empty() {
        content.setBody(&NSString::from_str(notification.body));
    }
    content.setCategoryIdentifier(&NSString::from_str(notification.category));
    if let Some(thread) = notification.thread {
        content.setThreadIdentifier(&NSString::from_str(thread));
    }
    if !notification.user_info.is_empty() {
        let keys: Vec<Retained<NSString>> = notification
            .user_info
            .iter()
            .map(|(key, _)| NSString::from_str(key))
            .collect();
        let values: Vec<Retained<NSString>> = notification
            .user_info
            .iter()
            .map(|(_, value)| NSString::from_str(value))
            .collect();
        let keys: Vec<&NSString> = keys.iter().map(|key| &**key).collect();
        let values: Vec<&NSString> = values.iter().map(|value| &**value).collect();
        let dict = NSDictionary::from_slices(&keys, &values);
        let erased: &NSDictionary = unsafe { &*(Retained::as_ptr(&dict) as *const NSDictionary) };
        unsafe { content.setUserInfo(erased) };
    }
    let request = UNNotificationRequest::requestWithIdentifier_content_trigger(
        &NSString::from_str(notification.id),
        &content,
        None,
    );
    center.addNotificationRequest_withCompletionHandler(
        &request,
        Some(&RcBlock::new(move |error: *mut NSError| {
            done(match os_error(error) {
                Some(err) => Err(err),
                None => Ok(()),
            })
        })),
    );
    Ok(())
}

pub fn remove(ids: &[&str]) -> Result<(), Error> {
    let center = center()?;
    let ids: Vec<Retained<NSString>> = ids.iter().map(|id| NSString::from_str(id)).collect();
    let ids = NSArray::from_retained_slice(&ids);
    center.removePendingNotificationRequestsWithIdentifiers(&ids);
    center.removeDeliveredNotificationsWithIdentifiers(&ids);
    Ok(())
}

fn center() -> Result<Retained<UNUserNotificationCenter>, Error> {
    match DELEGATE.get() {
        Some(_) => Ok(UNUserNotificationCenter::currentNotificationCenter()),
        None => Err(Error::Unavailable),
    }
}

fn category(category: &Category) -> Retained<UNNotificationCategory> {
    let actions: Vec<Retained<UNNotificationAction>> =
        category.actions.iter().map(action).collect();
    UNNotificationCategory::categoryWithIdentifier_actions_intentIdentifiers_options(
        &NSString::from_str(category.id),
        &NSArray::from_retained_slice(&actions),
        &NSArray::new(),
        UNNotificationCategoryOptions::empty(),
    )
}

fn action(action: &Action) -> Retained<UNNotificationAction> {
    let options = match action.style {
        ActionStyle::Foreground => UNNotificationActionOptions::Foreground,
        ActionStyle::Background => UNNotificationActionOptions::empty(),
        ActionStyle::AuthenticationRequired => UNNotificationActionOptions::AuthenticationRequired,
        ActionStyle::Destructive => UNNotificationActionOptions::Destructive,
    };
    let id = NSString::from_str(action.id);
    let title = NSString::from_str(action.title);
    match &action.text_input {
        None => UNNotificationAction::actionWithIdentifier_title_options(&id, &title, options),
        Some(input) => UNTextInputNotificationAction::actionWithIdentifier_title_options_textInputButtonTitle_textInputPlaceholder(
            &id,
            &title,
            options,
            &NSString::from_str(input.button),
            &NSString::from_str(input.placeholder),
        )
        .into_super(),
    }
}

fn os_error(error: *mut NSError) -> Option<Error> {
    let error = NonNull::new(error)?;
    Some(Error::Os(
        unsafe { error.as_ref() }.localizedDescription().to_string(),
    ))
}

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "OpenFrameNotificationDelegate"]
    #[ivars = Handlers]
    struct NotificationDelegate;

    unsafe impl NSObjectProtocol for NotificationDelegate {}

    unsafe impl UNUserNotificationCenterDelegate for NotificationDelegate {
        #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
        fn will_present_notification(
            &self,
            _center: &UNUserNotificationCenter,
            notification: &UNNotification,
            completion_handler: &DynBlock<dyn Fn(UNNotificationPresentationOptions)>,
        ) {
            let options = match (self.ivars().present)(&Delivered(notification.retain())) {
                Presentation::Banner => UNNotificationPresentationOptions::Banner,
                Presentation::BannerAndList => {
                    UNNotificationPresentationOptions::Banner
                        | UNNotificationPresentationOptions::List
                }
            };
            completion_handler.call((options,));
        }

        #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
        fn did_receive_response(
            &self,
            _center: &UNUserNotificationCenter,
            response: &UNNotificationResponse,
            completion_handler: &DynBlock<dyn Fn()>,
        ) {
            (self.ivars().respond)(&Response(response));
            completion_handler.call(());
        }
    }
);

impl NotificationDelegate {
    fn new(handlers: Handlers) -> Retained<Self> {
        let this = Self::alloc().set_ivars(handlers);
        unsafe { msg_send![super(this), init] }
    }
}
