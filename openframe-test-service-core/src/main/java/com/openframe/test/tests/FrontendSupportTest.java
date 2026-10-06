package com.openframe.test.tests;

import com.openframe.test.api.FeatureFlagApi;
import com.openframe.test.api.TenantEventApi;
import com.openframe.test.data.dto.event.TenantEventRequest;
import com.openframe.test.data.dto.featureflag.FeFeatureFlag;
import com.openframe.test.helpers.ai.RunId;
import io.restassured.response.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

// The two calls the UI shell makes on every session (CP-49): the feFeatureFlags read and the dashboard activity event publish.
@Tag("saas")
@Tag("frontend-support")
@DisplayName("Frontend feature flags and dashboard activity events")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class FrontendSupportTest extends BaseTest {

    // In the frontend's FEATURE_FLAG_NAMES and a yml default of every environment, so every tenant knows it.
    private static final String KNOWN_FLAG = "billings";
    private static final String UNKNOWN_FLAG = "e2e-unknown-flag-" + RunId.next();
    private static final String DASHBOARD_ACTIVITY = "DASHBOARD_ACTIVITY";
    // The frontend's skip_onboarding_main_dashboard subtype, sent SINGULAR like the UI, so repeated runs collapse to one event per user.
    private static final String SUBTYPE = "skip_onboarding_main_dashboard";
    private static final String SINGULAR = "SINGULAR";

    private static Map<String, Boolean> allFlags;

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Without names the query answers every flag the tenant knows, each once")
    @Order(1)
    public void testReadAllFlags() {
        List<FeFeatureFlag> flags = FeatureFlagApi.getFeFeatureFlags(null);

        assertThat(flags).as("The tenant has frontend flags").isNotEmpty();
        assertThat(flags).extracting(FeFeatureFlag::getName).as("Every flag has a name, listed once")
                .doesNotContainNull().doesNotHaveDuplicates().noneMatch(String::isBlank);
        assertThat(flags).extracting(FeFeatureFlag::getEnabled).as("Every flag has an enabled value").doesNotContainNull();
        assertThat(flags).extracting(FeFeatureFlag::getName).as("The yml default %s is listed", KNOWN_FLAG)
                .contains(KNOWN_FLAG);
        allFlags = flags.stream().collect(Collectors.toMap(FeFeatureFlag::getName, FeFeatureFlag::getEnabled));
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("An empty names list answers the same flags as no names")
    @Order(2)
    public void testEmptyNamesAnswersAllFlags() {
        requireAllFlags();

        List<FeFeatureFlag> flags = FeatureFlagApi.getFeFeatureFlags(List.of());

        assertThat(flags.stream().collect(Collectors.toMap(FeFeatureFlag::getName, FeFeatureFlag::getEnabled)))
                .as("names: [] is treated as no filter").isEqualTo(allFlags);
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Requested names are answered in order, a known flag with its value and an unknown one as false")
    @Order(3)
    public void testRequestedFlags() {
        requireAllFlags();

        List<FeFeatureFlag> flags = FeatureFlagApi.getFeFeatureFlags(List.of(KNOWN_FLAG, UNKNOWN_FLAG));

        assertThat(flags).extracting(FeFeatureFlag::getName).as("Exactly the requested names, in the requested order")
                .containsExactly(KNOWN_FLAG, UNKNOWN_FLAG);
        assertThat(flags.get(0).getEnabled()).as("%s has the value the unfiltered query reports", KNOWN_FLAG)
                .isEqualTo(allFlags.get(KNOWN_FLAG));
        assertThat(allFlags).as("The made-up %s is not a flag the tenant knows", UNKNOWN_FLAG).doesNotContainKey(UNKNOWN_FLAG);
        assertThat(flags.get(1).getEnabled()).as("An unknown flag defaults to false").isFalse();
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("An event type other than DASHBOARD_ACTIVITY is refused with 400")
    @Order(4)
    public void testUnsupportedEventTypeIsRefused() {
        Response response = TenantEventApi.publishEvent(TenantEventRequest.builder()
                .eventType("DEVICE_REGISTERED").subtype(SUBTYPE).repeatMode(SINGULAR).build());

        assertThat(response.statusCode()).as("DEVICE_REGISTERED is a TenantEventType outside the allowed set; body: %s",
                response.asString()).isEqualTo(400);
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("A blank subtype is refused with 400")
    @Order(5)
    public void testBlankSubtypeIsRefused() {
        Response response = TenantEventApi.publishEvent(TenantEventRequest.builder()
                .eventType(DASHBOARD_ACTIVITY).subtype("   ").repeatMode(SINGULAR).build());

        assertThat(response.statusCode()).as("subtype must have text; body: %s", response.asString()).isEqualTo(400);
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("A missing repeat mode is refused with 400")
    @Order(6)
    public void testMissingRepeatModeIsRefused() {
        Response response = TenantEventApi.publishEvent(TenantEventRequest.builder()
                .eventType(DASHBOARD_ACTIVITY).subtype(SUBTYPE).build());

        assertThat(response.statusCode()).as("repeatMode is required; body: %s", response.asString()).isEqualTo(400);
    }

    @Tag("feature")
    @Test
    @DisplayName("A dashboard activity event for the signed-in user is accepted with 202")
    @Order(7)
    public void testPublishDashboardActivity() {
        Response response = TenantEventApi.publishEvent(TenantEventRequest.builder()
                .eventType(DASHBOARD_ACTIVITY).subtype(SUBTYPE).repeatMode(SINGULAR).build());

        assertThat(response.statusCode()).as("The event is handed to Kafka and answered 202 ACCEPTED; body: %s",
                response.asString()).isEqualTo(202);
        assertThat(response.asString()).as("202 carries no body").isEmpty();
    }

    private static void requireAllFlags() {
        assumeTrue(allFlags != null,
                "The flags were not read in \"Without names the query answers every flag the tenant knows, each once\"");
    }
}
