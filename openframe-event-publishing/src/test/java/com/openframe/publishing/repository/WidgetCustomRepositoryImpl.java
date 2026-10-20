package com.openframe.publishing.repository;

import com.openframe.publishing.api.OutboxPublisher;
import com.openframe.publishing.fixture.Widgets.Widget;
import com.openframe.publishing.fixture.Widgets.WidgetSpec;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;

// Custom writes publish themselves through OutboxPublisher, the way a developer writes them.
@RequiredArgsConstructor
public class WidgetCustomRepositoryImpl implements WidgetCustomRepository {

    private final MongoTemplate mongoTemplate;
    private final OutboxPublisher outboxPublisher;
    private final WidgetSpec widgetSpec;

    @Override
    public Widget renameOne(String id, String name) {
        Query byId = Query.query(Criteria.where("id").is(id));
        Update update = new Update().set("name", name);
        FindAndModifyOptions returnNew = FindAndModifyOptions.options().returnNew(true);
        return outboxPublisher.publishChanged(widgetSpec,
                () -> mongoTemplate.findAndModify(byId, update, returnNew, Widget.class));
    }

    @Override
    public long renameAllOfTenant(String tenantId, String name) {
        Query ofTenant = Query.query(Criteria.where("tenantId").is(tenantId));
        List<String> ids = mongoTemplate.find(ofTenant, Widget.class).stream().map(Widget::getId).toList();
        Query byIds = Query.query(Criteria.where("id").in(ids));
        Update update = new Update().set("name", name);
        return outboxPublisher.publishChangedByIds(widgetSpec, ids,
                () -> mongoTemplate.updateMulti(byIds, update, Widget.class).getModifiedCount());
    }

    @Override
    public List<Widget> purgeNamed(String name) {
        Query byName = Query.query(Criteria.where("name").is(name));
        return outboxPublisher.publishDeleted(widgetSpec, () -> mongoTemplate.findAllAndRemove(byName, Widget.class));
    }
}
