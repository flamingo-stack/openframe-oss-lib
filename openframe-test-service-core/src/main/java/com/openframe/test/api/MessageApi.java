package com.openframe.test.api;

import com.openframe.test.data.dto.ai.ChatType;
import com.openframe.test.data.dto.ai.MessageConnection;
import com.openframe.test.data.dto.ai.MessageResponse;
import com.openframe.test.data.dto.ai.SendMessageRequest;
import com.openframe.test.data.dto.shared.CursorPaginationInput;
import io.restassured.http.ContentType;

import java.util.HashMap;
import java.util.Map;

import static com.openframe.test.api.graphql.ChatQueries.MESSAGES;
import static com.openframe.test.config.EnvironmentConfig.CHAT_GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

/**
 * Sends prompts to the assistant ({@code POST chat/api/v1/messages}) and reads the conversation back
 * via the {@code messages} GraphQL query at {@code chat/graphql}. Sending returns immediately with the
 * user message id; the assistant runs asynchronously.
 */
public class MessageApi {

    private static final String MESSAGES_REST = "chat/api/v1/messages";

    public static MessageResponse sendMessage(SendMessageRequest request) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .body(request)
                .post(MESSAGES_REST)
                .then().statusCode(200)
                .extract().as(MessageResponse.class);
    }

    public static MessageConnection getMessages(String dialogId, ChatType chatType, int limit) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("dialogId", dialogId);
        variables.put("chatType", chatType);
        variables.put("pagination", CursorPaginationInput.builder().limit(limit).build());
        Map<String, Object> body = Map.of(
                "query", MESSAGES,
                "variables", variables
        );
        return given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.messages", MessageConnection.class);
    }
}
