package com.openframe.test.api;

import com.openframe.test.data.dto.policy.CreatePolicyRequest;
import com.openframe.test.data.dto.policy.Policy;
import io.restassured.http.ContentType;

import java.util.List;
import java.util.Map;

import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static io.restassured.RestAssured.given;

public class MonitoringApi {

    private static final String POLICIES = "tools/fleetmdm-server/api/latest/fleet/policies";
    private static final String POLICY = POLICIES + "/{id}";
    private static final String POLICY_DELETE = POLICIES + "/delete";
    private static final String POLICY_HOSTS = "tools/fleetmdm-server/api/v1/fleet/policies/{id}/hosts";

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
}
