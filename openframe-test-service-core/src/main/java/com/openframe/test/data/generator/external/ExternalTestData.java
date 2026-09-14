package com.openframe.test.data.generator.external;

import net.datafaker.Faker;

/**
 * Naming for records the External API suite creates on a shared environment.
 *
 * <p>Every created record carries {@value #MARKER} in its name. That serves three purposes: teardown can
 * recognise its own rows, a human triaging the QA tenant can tell suite data from real data, and two
 * concurrent runs cannot collide on a name.
 *
 * <p>This is a deliberate departure from {@link com.openframe.test.data.generator.OrganizationGenerator},
 * which uses the fixed literal {@code "Tech Solutions Inc"} — fine for a suite that never cleans up,
 * unusable for one that must delete exactly what it made.
 */
public final class ExternalTestData {

    /** Substring identifying suite-created records; also the {@code search=} term teardown filters on. */
    public static final String MARKER = "extapi";

    private static final Faker FAKER = new Faker();

    private ExternalTestData() {
    }

    /** e.g. {@code "Hilpert Group extapi-3f9a2c81"}. */
    public static String uniqueName(String prefix) {
        return prefix + " " + MARKER + "-" + FAKER.random().hex(8).toLowerCase();
    }

    public static Faker faker() {
        return FAKER;
    }
}
