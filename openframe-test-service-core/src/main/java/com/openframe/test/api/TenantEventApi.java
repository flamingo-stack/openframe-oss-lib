package com.openframe.test.api;

import com.openframe.test.data.dto.event.TenantEventRequest;
import io.restassured.response.Response;

import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static io.restassured.RestAssured.given;

// Dashboard activity events (saas-api); a 202 means the event was handed to Kafka for the signed-in user, and there is no read-back.
public class TenantEventApi {

    private static final String EVENTS = "api/events";

    // Returns the response so a case can assert the 202 and the 400 refusals alike.
    public static Response publishEvent(TenantEventRequest request) {
        return given(getAuthorizedSpec())
                .body(request)
                .post(EVENTS);
    }
}
