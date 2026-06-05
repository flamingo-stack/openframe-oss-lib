package com.openframe.data.config;

import com.openframe.data.document.notification.NotificationContext;
import org.bson.conversions.Bson;
import org.springframework.data.mongodb.core.convert.DefaultMongoTypeMapper;
import org.springframework.data.util.TypeInformation;

public class NotificationContextSelectiveTypeMapper extends DefaultMongoTypeMapper {

    public NotificationContextSelectiveTypeMapper() {
        super(DefaultMongoTypeMapper.DEFAULT_TYPE_KEY);
    }

    @Override
    public void writeType(TypeInformation<?> info, Bson sink) {
        if (info != null && NotificationContext.class.isAssignableFrom(info.getType())) {
            return;
        }
        super.writeType(info, sink);
    }

    @Override
    public void writeType(Class<?> type, Bson sink) {
        if (type != null && NotificationContext.class.isAssignableFrom(type)) {
            return;
        }
        super.writeType(type, sink);
    }
}
