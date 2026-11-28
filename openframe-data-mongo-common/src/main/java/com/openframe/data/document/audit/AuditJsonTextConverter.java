package com.openframe.data.document.audit;

import org.bson.Document;
import org.bson.json.JsonMode;
import org.bson.json.JsonWriterSettings;
import org.springframework.data.core.TypeInformation;
import org.springframework.data.mongodb.core.convert.MongoConversionContext;
import org.springframework.data.mongodb.core.convert.MongoValueConverter;

import java.time.Instant;
import java.util.Map;

public class AuditJsonTextConverter implements MongoValueConverter<Map<String, ?>, String> {

    private static final JsonWriterSettings PLAIN_JSON = JsonWriterSettings.builder()
            .outputMode(JsonMode.RELAXED)
            .dateTimeConverter((millis, writer) -> writer.writeString(Instant.ofEpochMilli(millis).toString()))
            .decimal128Converter((amount, writer) -> writer.writeNumber(amount.bigDecimalValue().toPlainString()))
            .objectIdConverter((id, writer) -> writer.writeString(id.toHexString()))
            .build();
    private static final TypeInformation<Document> NO_TYPE_HINT = null;

    @Override
    public Map<String, ?> read(String json, MongoConversionContext context) {
        return Document.parse(json);
    }

    @Override
    public String write(Map<String, ?> values, MongoConversionContext context) {
        Document document = context.write(values, NO_TYPE_HINT);
        return document.toJson(PLAIN_JSON);
    }
}
