package com.openframe.test.tests.external;

import com.openframe.test.api.external.ExternalDeviceApi;
import com.openframe.test.api.external.ExternalLogApi;
import com.openframe.test.api.external.ExternalOrganizationApi;
import com.openframe.test.api.external.ExternalTicketApi;
import com.openframe.test.data.dto.external.common.PageInfo;
import com.openframe.test.data.dto.external.organization.OrganizationResponse;
import com.openframe.test.data.dto.external.organization.OrganizationsResponse;
import io.restassured.response.Response;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.condition.EnabledIf;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cursor pagination, asserted once across the four paginated collections rather than repeated in each
 * resource suite.
 *
 * <p>The four list endpoints share one contract — {@code limit} bounded {@code [1, 100]} with a default
 * of 20, plus an opaque cursor — so the boundary cases belong in one place. Each is checked against
 * every collection because they are four independent controllers, not one shared implementation.
 */
@Tag("saas")
@Tag("external-api")
@EnabledIf(ExternalApiBaseTest.EXTERNAL_API_KEY_CONDITION)
@DisplayName("External API - Pagination")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class ExternalPaginationTest extends ExternalApiBaseTest {

    /** Documented bounds on {@code limit}, from the controllers' {@code @Min}/{@code @Max}. */
    private static final int MAX_LIMIT = 100;

    /** The paginated collections, each as a raw call so the status code can be asserted directly. */
    private static final Map<String, Function<Map<String, Object>, Response>> PAGINATED = Map.of(
            "organizations", ExternalOrganizationApi::listOrganizationsRaw,
            "devices", ExternalDeviceApi::listDevicesRaw,
            "tickets", ExternalTicketApi::listTicketsRaw,
            "logs", ExternalLogApi::listLogsRaw);

    @Tag("feature")
    @Tag("read")
    @Order(1)
    @Test
    @DisplayName("limit below the minimum is rejected")
    public void testLimitBelowMinimumIsRejected() {
        PAGINATED.forEach((name, call) -> {
            Response response = call.apply(Map.of("limit", 0));
            assertThat(response.getStatusCode())
                    .as("%s: limit=0 is below the documented minimum of 1", name)
                    .isEqualTo(400);
        });
    }

    @Tag("feature")
    @Tag("read")
    @Order(2)
    @Test
    @DisplayName("limit above the maximum is rejected")
    public void testLimitAboveMaximumIsRejected() {
        PAGINATED.forEach((name, call) -> {
            Response response = call.apply(Map.of("limit", MAX_LIMIT + 1));
            assertThat(response.getStatusCode())
                    .as("%s: limit=%d exceeds the documented maximum of %d",
                            name, MAX_LIMIT + 1, MAX_LIMIT)
                    .isEqualTo(400);
        });
    }

    @Tag("feature")
    @Tag("read")
    @Order(3)
    @Test
    @DisplayName("limit at the boundaries is accepted")
    public void testLimitBoundariesAreAccepted() {
        PAGINATED.forEach((name, call) -> {
            assertThat(call.apply(Map.of("limit", 1)).getStatusCode())
                    .as("%s: limit=1 is the documented minimum and should be accepted", name)
                    .isEqualTo(200);
            assertThat(call.apply(Map.of("limit", MAX_LIMIT)).getStatusCode())
                    .as("%s: limit=%d is the documented maximum and should be accepted", name, MAX_LIMIT)
                    .isEqualTo(200);
        });
    }

    @Tag("feature")
    @Tag("read")
    @Order(4)
    @Test
    @DisplayName("Page size is honoured")
    public void testPageSizeIsHonoured() {
        OrganizationsResponse page = ExternalOrganizationApi.listOrganizations(Map.of("limit", 1));

        assertThat(page.getOrganizations()).as("limit=1 should return at most one row")
                .hasSizeLessThanOrEqualTo(1);
        assertThat(page.getPageInfo()).as("Paginated response should carry pageInfo").isNotNull();
    }

    @Tag("feature")
    @Tag("read")
    @Order(5)
    @Test
    @DisplayName("Cursor advances to a disjoint page")
    public void testCursorAdvancesToNextPage() {
        OrganizationsResponse first = ExternalOrganizationApi.listOrganizations(Map.of("limit", 1));
        PageInfo pageInfo = first.getPageInfo();

        if (pageInfo == null || !Boolean.TRUE.equals(pageInfo.getHasNextPage())) {
            log.info("Only one page of organizations on this tenant; nothing to page through");
            return;
        }
        assertThat(pageInfo.getEndCursor()).as("hasNextPage=true must come with an endCursor").isNotNull();

        OrganizationsResponse second = ExternalOrganizationApi
                .listOrganizations(Map.of("limit", 1, "cursor", pageInfo.getEndCursor()));

        assertThat(second.getOrganizations()).as("Following the cursor should return a page").isNotEmpty();
        // The point of a cursor is that it does not re-serve what the caller already has.
        List<String> firstIds = first.getOrganizations().stream().map(OrganizationResponse::getId).toList();
        assertThat(second.getOrganizations())
                .as("The second page must not repeat rows from the first")
                .noneSatisfy(org -> assertThat(firstIds).contains(org.getId()));
        assertThat(second.getPageInfo().getHasPreviousPage())
                .as("A page reached by cursor should report a previous page").isTrue();
    }

    @Tag("feature")
    @Tag("read")
    @Order(6)
    @Test
    @DisplayName("Malformed cursor is silently ignored (known weakness)")
    public void testMalformedCursorIsSilentlyIgnored() {
        OrganizationsResponse unpaged = ExternalOrganizationApi.listOrganizations(Map.of("limit", 2));
        Response response = ExternalOrganizationApi
                .listOrganizationsRaw(Map.of("limit", 2, "cursor", "not-a-valid-cursor"));

        // Characterisation, not endorsement. An unparseable cursor is accepted and answered with the
        // first page, indistinguishable from having sent no cursor at all — hasPreviousPage is even
        // reported as false. A client paging a large collection whose cursor gets corrupted therefore
        // restarts from the beginning silently and loops forever instead of erroring.
        //
        // Rejecting it with a 400 would be the better contract. This case pins the current behaviour so
        // the suite stays green while it stands and fails loudly the day it changes — when it does,
        // replace this with the 400 assertion rather than adjusting it.
        assertThat(response.getStatusCode())
                .as("Current behaviour: an unparseable cursor is accepted rather than rejected")
                .isEqualTo(200);

        OrganizationsResponse withBadCursor = response.as(OrganizationsResponse.class);
        List<String> unpagedIds = unpaged.getOrganizations().stream()
                .map(OrganizationResponse::getId).toList();
        List<String> badCursorIds = withBadCursor.getOrganizations().stream()
                .map(OrganizationResponse::getId).toList();

        assertThat(badCursorIds)
                .as("A malformed cursor currently yields exactly the unpaged first page")
                .isEqualTo(unpagedIds);
        assertThat(withBadCursor.getPageInfo().getHasPreviousPage())
                .as("And it reports no previous page, so a client cannot detect the reset")
                .isFalse();
    }

    @Tag("feature")
    @Tag("read")
    @Order(7)
    @Test
    @DisplayName("Cursor pointing past the end returns an empty page")
    public void testCursorPastEndReturnsEmptyPage() {
        // A well-formed cursor (base64 of an id) that no row can follow. Unlike the malformed case
        // above, this one behaves correctly: an empty page that reports a previous page.
        String cursor = Base64.getEncoder()
                .encodeToString("000000000000000000000000".getBytes(StandardCharsets.UTF_8));
        OrganizationsResponse response = ExternalOrganizationApi
                .listOrganizations(Map.of("limit", 2, "cursor", cursor));

        assertThat(response.getOrganizations()).as("No rows follow a cursor past the end").isEmpty();
        assertThat(response.getPageInfo().getHasNextPage()).as("There is nothing after the end").isFalse();
        assertThat(response.getPageInfo().getHasPreviousPage())
                .as("A page past the end still has pages before it").isTrue();
    }

}
