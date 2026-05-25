package com.openframe.data.repository.notification;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.notification.NotificationContext;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.WritingConverter;

@WritingConverter
@RequiredArgsConstructor
public class NotificationContextWriteConverter implements Converter<NotificationContext, Document> {

    private final ObjectMapper objectMapper;

    @Override
    public Document convert(NotificationContext source) {
        if (source == null) {
            return null;
        }
        try {
            return Document.parse(objectMapper.writeValueAsString(source));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(
                    "Failed to serialise NotificationContext (type=" + source.getType() + ")",
                    ex);
        }
    }
}
