package com.openframe.test.tests.external;

import com.openframe.test.api.external.ExternalDeviceApi;
import com.openframe.test.api.external.ExternalLogApi;
import com.openframe.test.api.external.ExternalCustomerApi;
import com.openframe.test.api.external.ExternalTicketApi;
import com.openframe.test.data.dto.external.common.PageInfo;
import com.openframe.test.data.dto.external.customer.CustomerResponse;
import com.openframe.test.data.dto.external.customer.CustomersResponse;
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
            "customers", ExternalCustomerApi::listCustomersRaw,
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
        CustomersResponse page = ExternalCustomerApi.listCustomers(Map.of("limit", 1));

        assertThat(page.getCustomers()).as("limit=1 should return at most one row")
                .hasSizeLessThanOrEqualTo(1);
        assertThat(page.getPageInfo()).as("Paginated response should carry pageInfo").isNotNull();
    }

    @Tag("feature")
    @Tag("read")
    @Order(5)
    @Test
    @DisplayName("Cursor advances to a disjoint page")
    public void testCursorAdvancesToNextPage() {
        CustomersResponse first = ExternalCustomerApi.listCustomers(Map.of("limit", 1));
        PageInfo pageInfo = first.getPageInfo();

        if (pageInfo == null || !Boolean.TRUE.equals(pageInfo.getHasNextPage())) {
            log.info("Only one page of customers on this tenant; nothing to page through");
            return;
        }
        assertThat(pageInfo.getEndCursor()).as("hasNextPage=true must come with an endCursor").isNotNull();

        CustomersResponse second = ExternalCustomerApi
                .listCustomers(Map.of("limit", 1, "cursor", pageInfo.getEndCursor()));

        assertThat(second.getCustomers()).as("Following the cursor should return a page").isNotEmpty();
        // The point of a cursor is that it does not re-serve what the caller already has.
        List<String> firstIds = first.getCustomers().stream().map(CustomerResponse::getId).toList();
        assertThat(second.getCustomers())
                .as("The second page must not repeat rows from the first")
                .noneSatisfy(org -> assertThat(firstIds).contains(org.getId()));
        assertThat(second.getPageInfo().getHasPreviousPage())
                .as("A page reached by cursor should report a previous page").isTrue();
    }

    @Tag("feature")
    @Tag("read")
    @Order(6)
    @Test
    @DisplayName("Malformed cursor is rejected")
    public void testMalformedCursorIsRejected() {
        Response response = ExternalCustomerApi
                .listCustomersRaw(Map.of("limit", 2, "cursor", "not-a-valid-cursor"));

        // This used to be a characterisation test. The API previously accepted an unparseable cursor and
        // answered with the first page, indistinguishable from sending no cursor at all — so a client
        // whose cursor got corrupted mid-pagination silently restarted and looped forever. It now
        // rejects, which is the correct contract, and this asserts the fix rather than the old wart.
        assertThat(response.getStatusCode())
                .as("An unparseable cursor should be rejected, not silently reset to the first page")
                .isEqualTo(400);
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
        CustomersResponse response = ExternalCustomerApi
                .listCustomers(Map.of("limit", 2, "cursor", cursor));

        assertThat(response.getCustomers()).as("No rows follow a cursor past the end").isEmpty();
        assertThat(response.getPageInfo().getHasNextPage()).as("There is nothing after the end").isFalse();
        assertThat(response.getPageInfo().getHasPreviousPage())
                .as("A page past the end still has pages before it").isTrue();
    }

}
