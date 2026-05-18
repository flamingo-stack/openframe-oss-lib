package com.openframe.data.repository.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.notification.NotificationContext;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.bson.json.JsonMode;
import org.bson.json.JsonWriterSettings;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;

import java.io.IOException;

@ReadingConverter
@RequiredArgsConstructor
public class NotificationContextReadConverter implements Converter<Document, NotificationContext> {

    private static final JsonWriterSettings RELAXED_JSON =
            JsonWriterSettings.builder().outputMode(JsonMode.RELAXED).build();

    private final ObjectMapper objectMapper;

    @Override
    public NotificationContext convert(Document source) {
        if (source == null) {
            return null;
        }
        try {
            return objectMapper.readValue(source.toJson(RELAXED_JSON), NotificationContext.class);
        } catch (IOException ex) {
            throw new IllegalStateException(
                    "Failed to deserialise NotificationContext (id=" + source.get("_id")
                            + ", type=" + source.get("type") + ")",
                    ex);
        }
    }
}
