package com.openframe.test.api;

import java.nio.file.Path;

import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static io.restassured.RestAssured.given;

public class AttachmentApi {

    public static void uploadAttachmentFile(String uploadUrl, Path file, String contentType) {
        given(getAuthorizedSpec())
                .urlEncodingEnabled(false)
                .contentType(contentType)
                .body(file.toFile())
                .put(uploadUrl)
                .then().statusCode(200);
    }

    public static byte[] downloadAttachmentFile(String downloadUrl) {
        return given(getAuthorizedSpec())
                .urlEncodingEnabled(false)
                .get(downloadUrl)
                .then().statusCode(200)
                .extract().asByteArray();
    }
}