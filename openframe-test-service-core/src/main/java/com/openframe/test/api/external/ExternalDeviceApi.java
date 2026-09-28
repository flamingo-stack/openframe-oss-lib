package com.openframe.test.api.external;

import com.openframe.test.data.dto.external.common.ExternalErrorResponse;
import com.openframe.test.data.dto.external.device.DeviceFilterResponse;
import com.openframe.test.data.dto.external.device.DeviceResponse;
import com.openframe.test.data.dto.external.device.DevicesResponse;
import com.openframe.test.data.dto.external.device.UpdateDeviceNicknameRequest;
import com.openframe.test.data.dto.external.device.UpdateDeviceStatusRequest;
import io.restassured.response.Response;

import java.util.Map;

import static com.openframe.test.helpers.RequestSpecHelper.getExternalApiSpec;
import static io.restassured.RestAssured.given;

/** External API client for {@code /api/v1/devices}. Devices are addressed by {@code machineId}, not {@code id}. */
public class ExternalDeviceApi {

    private static final String DEVICES = "api/v1/devices";
    private static final String FILTERS = DEVICES + "/filters";
    private static final String BY_MACHINE_ID = DEVICES + "/{machineId}";
    private static final String NICKNAME = BY_MACHINE_ID + "/nickname";

    public static DevicesResponse listDevices() {
        return listDevices(Map.of());
    }

    public static DevicesResponse listDevices(Map<String, Object> queryParams) {
        return given(getExternalApiSpec())
                .queryParams(queryParams)
                .get(DEVICES)
                .then().statusCode(200)
                .extract().as(DevicesResponse.class);
    }

    public static Response listDevicesRaw(Map<String, Object> queryParams) {
        return given(getExternalApiSpec()).queryParams(queryParams).get(DEVICES);
    }

    public static DeviceFilterResponse getFilters() {
        return getFilters(Map.of());
    }

    public static DeviceFilterResponse getFilters(Map<String, Object> queryParams) {
        return given(getExternalApiSpec())
                .queryParams(queryParams)
                .get(FILTERS)
                .then().statusCode(200)
                .extract().as(DeviceFilterResponse.class);
    }

    public static DeviceResponse getDevice(String machineId) {
        return given(getExternalApiSpec())
                .pathParam("machineId", machineId)
                .get(BY_MACHINE_ID)
                .then().statusCode(200)
                .extract().as(DeviceResponse.class);
    }

    public static ExternalErrorResponse attemptGetDevice(String machineId, int expectedStatus) {
        return given(getExternalApiSpec())
                .pathParam("machineId", machineId)
                .get(BY_MACHINE_ID)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    /**
     * 204 No Content. The contract accepts only terminal states (DELETED / ARCHIVED) and offers no way
     * back to ACTIVE, so this is irreversible through the External API — callers must be sure the device
     * is expendable.
     */
    public static void updateStatus(String machineId, String status) {
        given(getExternalApiSpec())
                .pathParam("machineId", machineId)
                .body(UpdateDeviceStatusRequest.builder().status(status).build())
                .patch(BY_MACHINE_ID)
                .then().statusCode(204);
    }

    public static Response updateStatusRaw(String machineId, String status) {
        return given(getExternalApiSpec())
                .pathParam("machineId", machineId)
                .body(UpdateDeviceStatusRequest.builder().status(status).build())
                .patch(BY_MACHINE_ID);
    }

    /** 204 No Content. Reversible — pass the captured original to restore it. */
    public static void updateNickname(String machineId, String nickname) {
        given(getExternalApiSpec())
                .pathParam("machineId", machineId)
                .body(UpdateDeviceNicknameRequest.builder().nickname(nickname).build())
                .patch(NICKNAME)
                .then().statusCode(204);
    }

    public static Response updateNicknameRaw(String machineId, String nickname) {
        return given(getExternalApiSpec())
                .pathParam("machineId", machineId)
                .body(UpdateDeviceNicknameRequest.builder().nickname(nickname).build())
                .patch(NICKNAME);
    }
}
