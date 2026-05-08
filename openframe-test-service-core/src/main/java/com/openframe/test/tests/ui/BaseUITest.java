package com.openframe.test.tests.ui;

import com.microsoft.playwright.*;
import com.openframe.test.data.dto.user.User;
import com.openframe.test.pages.NavigationSidebar;
import com.openframe.test.pages.flow.UILoginFlow;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.extension.AfterTestExecutionCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.LifecycleMethodExecutionExceptionHandler;
import org.junit.jupiter.api.extension.RegisterExtension;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static com.openframe.test.config.UserConfig.getUser;

@Slf4j
abstract class BaseUITest {

    private static final Path FAILURE_DIR = Paths.get("/tmp/playwright-failures");

    protected static Playwright playwright;
    protected static Browser browser;

    protected BrowserContext context;
    protected Page page;
    protected NavigationSidebar navigationSidebar;

    @RegisterExtension
    final AfterTestExecutionCallback afterTest = ctx ->
            captureArtifacts(ctx.getDisplayName(), ctx.getExecutionException().isPresent());

    @RegisterExtension
    final LifecycleMethodExecutionExceptionHandler beforeEachFail = new LifecycleMethodExecutionExceptionHandler() {
        @Override
        public void handleBeforeEachMethodExecutionException(ExtensionContext ctx, Throwable t) throws Throwable {
            captureArtifacts(ctx.getDisplayName(), true);
            throw t;
        }
    };

    @BeforeAll
    static void launchBrowser() {
        playwright = Playwright.create();
        browser = playwright.chromium().launch(
                new BrowserType.LaunchOptions().setHeadless(true)
        );
    }

    @AfterAll
    static void closeBrowser() {
        browser.close();
        playwright.close();
    }

    @BeforeEach
    void newContext(TestInfo testInfo) {
        context = browser.newContext(new Browser.NewContextOptions()
                .setViewportSize(1920, 1080));
        context.tracing().start(new Tracing.StartOptions()
                .setScreenshots(true)
                .setSnapshots(true)
                .setSources(true));
        page = context.newPage();
        page.onConsoleMessage(msg ->
                log.info("[console:{}] {}", msg.type(), msg.text()));
        page.onPageError(err -> log.warn("[pageError] {}", err));
        page.onRequestFailed(req ->
                log.warn("[requestFailed] {} {} ({})",
                        req.method(), req.url(), req.failure()));
        User user = getUser();
        UILoginFlow loginFlow = new UILoginFlow(page);
        navigationSidebar = loginFlow.login(user.getEmail(), user.getPassword());
    }

    @AfterEach
    void closeContext() {
        if (context != null) {
            try {
                context.close();
            } catch (Exception ignored) {
            }
        }
    }

    private void captureArtifacts(String testName, boolean failed) {
        if (context == null) {
            return;
        }
        String slug = testName.replaceAll("[^A-Za-z0-9._-]+", "_");
        long ts = System.currentTimeMillis();
        try {
            if (failed) {
                Files.createDirectories(FAILURE_DIR);
                Path trace = FAILURE_DIR.resolve(slug + "-" + ts + ".trace.zip");
                context.tracing().stop(new Tracing.StopOptions().setPath(trace));
                if (page != null && !page.isClosed()) {
                    Path html = FAILURE_DIR.resolve(slug + "-" + ts + ".html");
                    Path png = FAILURE_DIR.resolve(slug + "-" + ts + ".png");
                    Files.writeString(html, "<!-- url: " + page.url() + " -->\n" + page.content());
                    page.screenshot(new Page.ScreenshotOptions().setPath(png).setFullPage(true));
                    log.error("Captured failure artifacts: trace={} html={} png={} url={}",
                            trace, html, png, page.url());
                } else {
                    log.error("Captured failure trace: {}", trace);
                }
            } else {
                context.tracing().stop();
            }
        } catch (Exception e) {
            log.error("Failed to capture artifacts for {}", testName, e);
        }
    }
}
