package com.openframe.data.repository.rmm.osupdate;

import org.bson.Document;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.query.Update;

final class InsertIfAbsentUpdate {

    private InsertIfAbsentUpdate() {
    }

    // Every field goes into $setOnInsert: an upsert with this update writes the document once and never changes it.
    static Update of(MongoConverter mongoConverter, Object document) {
        Document fields = new Document();
        mongoConverter.write(document, fields);
        Update update = new Update();
        fields.forEach(update::setOnInsert);
        return update;
    }
}
