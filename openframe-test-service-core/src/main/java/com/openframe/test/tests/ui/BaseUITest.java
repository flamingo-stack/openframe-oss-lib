package com.openframe.test.tests.ui;

import com.microsoft.playwright.*;
import com.openframe.test.data.dto.user.User;
import com.openframe.test.pages.NavigationSidebar;
import com.openframe.test.pages.flow.UILoginFlow;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;

import static com.openframe.test.config.UserConfig.getUser;

abstract class BaseUITest {

    protected static Playwright playwright;
    protected static Browser browser;

    protected BrowserContext context;
    protected Page page;
    protected NavigationSidebar navigationSidebar;

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
    void newContext() {
        context = browser.newContext(new Browser.NewContextOptions()
                .setViewportSize(1920, 1080));
        page = context.newPage();
        User user = getUser();
        UILoginFlow loginFlow = new UILoginFlow(page);
        navigationSidebar = loginFlow.login(user.getEmail(), user.getPassword());
    }

    @AfterEach
    void closeContext() {
        context.close();
    }
}
