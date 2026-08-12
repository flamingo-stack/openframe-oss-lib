package com.openframe.test.api;

import com.openframe.test.data.dto.policy.CreatePolicyRequest;
import com.openframe.test.data.dto.policy.Policy;
import com.openframe.test.data.dto.policy.ScheduledQuery;
import io.restassured.http.ContentType;

import java.util.List;
import java.util.Map;

import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.is;

public class MonitoringApi {

    private static final String POLICIES = "tools/fleetmdm-server/api/latest/fleet/policies";
    private static final String POLICY = POLICIES + "/{id}";
    private static final String POLICY_DELETE = POLICIES + "/delete";
    private static final String POLICY_HOSTS = "tools/fleetmdm-server/api/v1/fleet/policies/{id}/hosts";
    private static final String QUERIES = "tools/fleetmdm-server/api/v1/fleet/queries";
    private static final String QUERY = QUERIES + "/{id}";
    private static final String QUERY_DELETE = QUERIES + "/id/{id}";
    private static final String HOST_REFETCH = "tools/fleetmdm-server/api/latest/fleet/hosts/{fleetId}/refetch";
    private static final String TRIGGER = "tools/fleetmdm-server/api/latest/fleet/trigger";

    /**
     * The cron schedule that recomputes policy aggregates. Fleet updates a policy's
     * {@code passing_host_count} / {@code failing_host_count} on this schedule (roughly hourly), not
     * when a host reports — so a test asserting on those counts has to force this run.
     */
    public static final String CLEANUPS_THEN_AGGREGATION = "cleanups_then_aggregation";

    public static Policy getPolicy(Integer policyId) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .pathParam("id", policyId)
                .get(POLICY)
                .then().statusCode(200)
                .extract().jsonPath().getObject("policy", Policy.class);
    }

    public static List<Policy> getPolicies() {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .get(POLICIES)
                .then().statusCode(200)
                .extract().jsonPath().getList("policies", Policy.class);
    }

    public static String selectPolicyDevices(Integer policyId, Integer... hostIds) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .pathParam("id", policyId)
                .body(Map.of("host_ids", List.of(hostIds)))
                .put(POLICY_HOSTS)
                .then().statusCode(200)
                .extract().asString();
    }

    public static List<Integer> deletePolicy(Integer... policyIds) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .body(Map.of("ids", List.of(policyIds)))
                .post(POLICY_DELETE)
                .then().statusCode(200)
                .extract().jsonPath().getList("deleted", Integer.class);
    }

    public static Policy createPolicy(CreatePolicyRequest request) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .body(request)
                .post(POLICIES)
                .then().statusCode(200)
                .extract().jsonPath().getObject("policy", Policy.class);
    }

    // ---- Fleet scheduled queries (a saved query with interval > 0) -----------------------------

    public static List<ScheduledQuery> getScheduledQueries() {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .get(QUERIES)
                .then().statusCode(200)
                .extract().jsonPath().getList("queries", ScheduledQuery.class);
    }

    public static ScheduledQuery getScheduledQuery(Integer queryId) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .pathParam("id", queryId)
                .get(QUERY)
                .then().statusCode(200)
                .extract().jsonPath().getObject("query", ScheduledQuery.class);
    }

    public static ScheduledQuery createScheduledQuery(String name, String query, int intervalSeconds) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .body(Map.of("name", name, "query", query, "description", "e2e seed",
                        "interval", intervalSeconds, "platform", "windows"))
                .post(QUERIES)
                .then().statusCode(200)
                .extract().jsonPath().getObject("query", ScheduledQuery.class);
    }

    public static void deleteScheduledQuery(Integer queryId) {
        given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .pathParam("id", queryId)
                .delete(QUERY_DELETE)
                .then().statusCode(200);
    }

    // ---- Triggering policy execution -----------------------------------------------------------

    /**
     * Flags the Fleet host's details, labels and policies for refetch at its next check-in.
     * Asynchronous: Fleet returns 200 immediately and the host reports {@code refetch_requested}
     * until the refetch lands.
     *
     * @param fleetId the Fleet numeric host id, e.g. from {@code DeviceGenerator.getFleetId(device)}
     */
    public static void refetchFleetHost(String fleetId) {
        given(getAuthorizedSpec())
                .pathParam("fleetId", fleetId)
                .post(HOST_REFETCH)
                .then().statusCode(200);
    }

    // ---- Fleet cron schedules -----------------------------------------------------------------

    /**
     * Forces an ad-hoc run of a Fleet cron schedule (the endpoint behind {@code fleetctl trigger}),
     * collapsing a wait of up to an hour into seconds. Pass {@link #CLEANUPS_THEN_AGGREGATION} to
     * recompute policy pass/fail aggregates.
     *
     * <p>Accepts {@code 409} as well as {@code 200}: Fleet returns Conflict when that schedule is
     * already running, which happens whenever an ad-hoc trigger collides with the regular hourly run.
     * The run the caller wants is underway either way, so treating Conflict as failure would make
     * callers flaky. An unknown schedule name is a {@code 404} and still fails.
     *
     * <p><b>This is server-wide, not tenant-scoped</b> — it runs the cron for the whole Fleet instance,
     * so on a shared Fleet it affects every tenant, not just this one.
     */
    public static void triggerCronSchedule(String name) {
        given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .queryParam("name", name)
                .post(TRIGGER)
                .then().statusCode(anyOf(is(200), is(409)));
    }
}
