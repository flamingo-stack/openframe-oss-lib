use super::*;
use std::path::PathBuf;

const DIR: &str = r"C:\Program Files\App";
const MAIN: &str = r"C:\Program Files\App\app.exe";
const EXPLORER: &str = r"C:\Windows\explorer.exe";
const SCM: &str = r"C:\Windows\System32\services.exe";

fn derived(names: &[&str]) -> AppIdentity {
    AppIdentity::App {
        install_dir: PathBuf::from(DIR),
        main_images: MainImages::Derived(names.iter().map(|n| n.to_string()).collect()),
    }
}

fn unknown() -> AppIdentity {
    AppIdentity::App {
        install_dir: PathBuf::from(DIR),
        main_images: MainImages::Unknown,
    }
}

fn process(pid: u32, image: &str, parent: Option<&str>) -> RunningProcess {
    RunningProcess {
        pid,
        image: PathBuf::from(image),
        parent_image: parent.map(PathBuf::from),
        is_service: false,
        session: None,
    }
}

fn service(pid: u32, image: &str) -> RunningProcess {
    RunningProcess {
        is_service: true,
        ..process(pid, image, Some(SCM))
    }
}

/// Holder pids `decide` reports; empty means `Clear`.
fn holder_pids(identity: &AppIdentity, processes: &[RunningProcess]) -> Vec<u32> {
    match decide(identity, processes) {
        GateDecision::Clear => Vec::new(),
        GateDecision::Blocked(BlockReason::Running { holders }) => {
            holders.iter().map(|h| h.pid).collect()
        }
        GateDecision::Blocked(BlockReason::Undetermined(reason)) => {
            panic!("decide never yields Undetermined: {reason}")
        }
    }
}

#[test]
fn derived_main_images() {
    let cases: &[(&str, Vec<RunningProcess>, Vec<u32>)] = &[
        ("nothing runs", vec![], vec![]),
        (
            "only unrelated processes",
            vec![process(1, r"C:\Other\app.exe", Some(EXPLORER))],
            vec![],
        ),
        ("app open", vec![process(1, MAIN, Some(EXPLORER))], vec![1]),
        (
            "same-image children do not count",
            vec![
                process(1, MAIN, Some(EXPLORER)),
                process(2, MAIN, Some(MAIN)),
                process(3, MAIN, Some(MAIN)),
            ],
            vec![1],
        ),
        (
            "parent gone counts as root",
            vec![process(1, MAIN, None)],
            vec![1],
        ),
        (
            "helper with another name",
            vec![process(1, r"C:\Program Files\App\helper.exe", Some(MAIN))],
            vec![],
        ),
        (
            "service with another name",
            vec![service(1, r"C:\Program Files\App\AppService.exe")],
            vec![],
        ),
        (
            "service running the main image",
            vec![service(1, MAIN)],
            vec![],
        ),
        (
            "versioned subfolder still matches by name",
            vec![process(
                1,
                r"C:\Program Files\App\app-3.6.6\app.exe",
                Some(MAIN),
            )],
            vec![1],
        ),
        (
            "path and name compare case-insensitively",
            vec![process(1, r"c:\PROGRAM FILES\app\APP.EXE", Some(EXPLORER))],
            vec![1],
        ),
        (
            "sibling dir with a shared prefix is outside",
            vec![process(1, r"C:\Program Files\App2\app.exe", Some(EXPLORER))],
            vec![],
        ),
        (
            "same name outside the install dir",
            vec![process(1, r"C:\Temp\app.exe", Some(EXPLORER))],
            vec![],
        ),
    ];

    for (name, processes, expected) in cases {
        assert_eq!(
            &holder_pids(&derived(&["app.exe"]), processes),
            expected,
            "{name}"
        );
    }
}

#[test]
fn derived_names_match_whatever_their_case() {
    let processes = [process(1, MAIN, Some(EXPLORER))];
    assert_eq!(holder_pids(&derived(&["App.EXE"]), &processes), vec![1]);
}

#[test]
fn macos_app_bundles() {
    const LAUNCHD: &str = "/sbin/launchd";
    const CODE: &str = "/Applications/Visual Studio Code.app/Contents/MacOS/Code";
    const HELPER: &str = "/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper (Renderer).app/Contents/MacOS/Code Helper (Renderer)";
    let identity = AppIdentity::App {
        install_dir: PathBuf::from("/Applications/Visual Studio Code.app"),
        main_images: MainImages::Derived(vec!["Code".to_string()]),
    };
    let cases: &[(&str, Vec<RunningProcess>, Vec<u32>)] = &[
        (
            "app open, started by launchd",
            vec![process(1, CODE, Some(LAUNCHD))],
            vec![1],
        ),
        (
            "helpers in nested bundles do not count",
            vec![
                process(1, CODE, Some(LAUNCHD)),
                process(2, HELPER, Some(CODE)),
            ],
            vec![1],
        ),
        (
            "same-image children do not count",
            vec![
                process(1, CODE, Some(LAUNCHD)),
                process(2, CODE, Some(CODE)),
            ],
            vec![1],
        ),
        (
            "only a helper left running",
            vec![process(2, HELPER, Some(LAUNCHD))],
            vec![],
        ),
        (
            "same name in another bundle",
            vec![process(
                1,
                "/Applications/Other.app/Contents/MacOS/Code",
                Some(LAUNCHD),
            )],
            vec![],
        ),
    ];

    for (name, processes, expected) in cases {
        assert_eq!(&holder_pids(&identity, processes), expected, "{name}");
    }
}

#[test]
fn unknown_main_images_hold_on_any_root_non_service_process() {
    let tray = r"C:\Program Files\App\tray.exe";
    let cases: &[(&str, Vec<RunningProcess>, Vec<u32>)] = &[
        ("nothing runs", vec![], vec![]),
        (
            "root process under the dir",
            vec![process(1, tray, Some(EXPLORER))],
            vec![1],
        ),
        (
            "same-image children do not count",
            vec![
                process(1, tray, Some(EXPLORER)),
                process(2, tray, Some(tray)),
            ],
            vec![1],
        ),
        (
            "helper started by the app is its own root",
            vec![
                process(1, tray, Some(EXPLORER)),
                process(2, r"C:\Program Files\App\helper.exe", Some(tray)),
            ],
            vec![1, 2],
        ),
        (
            "only a service under the dir",
            vec![service(1, r"C:\Program Files\App\AppService.exe")],
            vec![],
        ),
        (
            "host outside the dir (shell extension)",
            vec![process(1, EXPLORER, None)],
            vec![],
        ),
    ];

    for (name, processes, expected) in cases {
        assert_eq!(&holder_pids(&unknown(), processes), expected, "{name}");
    }
}

#[test]
fn no_app_is_clear_whatever_runs() {
    let processes = [process(1, MAIN, Some(EXPLORER))];
    assert_eq!(decide(&AppIdentity::NoApp, &processes), GateDecision::Clear);
}

#[test]
fn holders_carry_the_image_and_session() {
    let in_session_2 = RunningProcess {
        session: Some(2),
        ..process(7, MAIN, Some(EXPLORER))
    };

    assert_eq!(
        decide(&derived(&["app.exe"]), &[in_session_2]),
        GateDecision::Blocked(BlockReason::Running {
            holders: vec![Holder {
                pid: 7,
                image: PathBuf::from(MAIN),
                session: Some(2),
            }]
        })
    );
}

#[test]
fn is_under_edges() {
    let cases: &[(&str, &str, bool)] = &[
        (r"C:\A\b.exe", r"C:\A", true),
        (r"C:\A\b.exe", r"C:\A\", true),
        (r"C:\A\sub\b.exe", r"C:\A", true),
        (r"C:\A", r"C:\A", false),
        (r"C:\A\", r"C:\A", false),
        (r"C:\AB\b.exe", r"C:\A", false),
        (r"C:\a\B.EXE", r"c:\A", true),
        (
            "/Applications/X.app/Contents/MacOS/X",
            "/Applications/X.app",
            true,
        ),
        (r"C:\A\b.exe", "", false),
    ];
    for (path, dir, expected) in cases {
        assert_eq!(
            is_under(Path::new(path), Path::new(dir)),
            *expected,
            "{path} under {dir}"
        );
    }
}
