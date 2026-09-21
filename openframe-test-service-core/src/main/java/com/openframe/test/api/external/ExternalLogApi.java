package com.openframe.test.api.external;

import com.openframe.test.data.dto.external.common.ExternalErrorResponse;
import com.openframe.test.data.dto.external.log.LogDetailsResponse;
import com.openframe.test.data.dto.external.log.LogFilterResponse;
import com.openframe.test.data.dto.external.log.LogsResponse;
import io.restassured.response.Response;

import java.util.Map;

import static com.openframe.test.helpers.RequestSpecHelper.getExternalApiSpec;
import static io.restassured.RestAssured.given;

/**
 * External API client for {@code /api/v1/logs}.
 *
 * <p>Backed by Pinot, so {@code 503 PINOT_QUERY_ERROR} is a real failure mode of the environment rather
 * than of the request.
 */
public class ExternalLogApi {

    private static final String LOGS = "api/v1/logs";
    private static final String DETAILS = LOGS + "/details";
    private static final String FILTERS = LOGS + "/filters";

    public static LogsResponse listLogs() {
        return listLogs(Map.of());
    }

    public static LogsResponse listLogs(Map<String, Object> queryParams) {
        return given(getExternalApiSpec())
                .queryParams(queryParams)
                .get(LOGS)
                .then().statusCode(200)
                .extract().as(LogsResponse.class);
    }

    public static Response listLogsRaw(Map<String, Object> queryParams) {
        return given(getExternalApiSpec()).queryParams(queryParams).get(LOGS);
    }

    public static LogFilterResponse getFilters() {
        return getFilters(Map.of());
    }

    public static LogFilterResponse getFilters(Map<String, Object> queryParams) {
        return given(getExternalApiSpec())
                .queryParams(queryParams)
                .get(FILTERS)
                .then().statusCode(200)
                .extract().as(LogFilterResponse.class);
    }

    /** All five params are required by the contract; omitting any one is a 400. */
    public static LogDetailsResponse getDetails(String ingestDay, String toolType, String eventType,
                                                String timestamp, String toolEventId) {
        return given(getExternalApiSpec())
                .queryParams(detailParams(ingestDay, toolType, eventType, timestamp, toolEventId))
                .get(DETAILS)
                .then().statusCode(200)
                .extract().as(LogDetailsResponse.class);
    }

    public static ExternalErrorResponse attemptGetDetails(Map<String, Object> queryParams, int expectedStatus) {
        return given(getExternalApiSpec())
                .queryParams(queryParams)
                .get(DETAILS)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    public static Response getDetailsRaw(Map<String, Object> queryParams) {
        return given(getExternalApiSpec()).queryParams(queryParams).get(DETAILS);
    }

    public static Map<String, Object> detailParams(String ingestDay, String toolType, String eventType,
                                                   String timestamp, String toolEventId) {
        return Map.of("ingestDay", ingestDay, "toolType", toolType, "eventType", eventType,
                "timestamp", timestamp, "toolEventId", toolEventId);
    }
}
