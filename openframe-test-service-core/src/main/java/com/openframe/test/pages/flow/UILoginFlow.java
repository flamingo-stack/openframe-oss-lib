package com.openframe.test.pages.flow;

import com.microsoft.playwright.Page;
import com.openframe.test.pages.AuthEntryPage;
import com.openframe.test.pages.DashboardPage;
import com.openframe.test.pages.NavigationSidebar;

public class UILoginFlow {

    final Page page;

    public UILoginFlow(Page page) {
        this.page = page;
    }

    public NavigationSidebar login(String email, String password) {
        DashboardPage dashboardPage = new AuthEntryPage(this.page)
                .navigate()
                .submitEmail(email)
                .clickSignInWithOpenFrameSso()
                .login(email, password);

        page.waitForCondition(dashboardPage::isLoaded);

        return new NavigationSidebar(this.page);
    }
}
