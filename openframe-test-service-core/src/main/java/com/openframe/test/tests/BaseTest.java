package com.openframe.test.tests;

import com.openframe.test.helpers.AuthHelper;
import org.junit.jupiter.api.BeforeAll;

public abstract class BaseTest {

    @BeforeAll
    public static void setup() {
        AuthHelper.clearCookies();
    }
}
