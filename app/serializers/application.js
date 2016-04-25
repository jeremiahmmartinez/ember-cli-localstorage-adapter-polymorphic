import Ember from 'ember';
import LSSerializer from 'ember-cli-localstorage-adapter/localstorage-serializer';

export default LSSerializer.extend({
    /**
    * Serializer methods taken from https://github.com/CameronWakal/modtest/blob/master/app/serializers/application.js
    */
    serializeHasMany(snapshot, json, relationship){
      var attr = relationship.key;
      let isPolymorphic = relationship.options.polymorphic;

      if (this.noSerializeOptionSpecified(attr)) {
        this.serializeHasManyUnembedded(snapshot, json, relationship);
        return;
      }
      var includeIds = this.hasSerializeIdsOption(attr);
      var includeRecords = this.hasSerializeRecordsOption(attr);
      var key, hasMany;
      if (includeIds) {
        key = this.keyForRelationship(attr, relationship.kind, 'serialize');
        hasMany = snapshot.hasMany(attr);
        let jsonOutput = Ember.A(hasMany).map( rel => {
          if(isPolymorphic){
            return {id:rel.id, type:rel.modelName};
          } else {
            return rel.id;
          }
        });
        json[key] = jsonOutput;
      } else if (includeRecords) {
        key = this.keyForAttribute(attr, 'serialize');
        hasMany = snapshot.hasMany(attr);

        Ember.warn(
          `The embedded relationship '${key}' is undefined for '${snapshot.modelName}' with id '${snapshot.id}'. Please include it in your original payload.`,
          Ember.typeOf(hasMany) !== 'undefined',
          { id: 'ds.serializer.embedded-relationship-undefined' }
        );

        json[key] = Ember.A(hasMany).map( embeddedSnapshot => {
          var embeddedJson = embeddedSnapshot.record.serialize({ includeId: true });
          this.removeEmbeddedForeignKey(snapshot, embeddedSnapshot, relationship, embeddedJson);
          if(isPolymorphic){
            embeddedJson['type'] = embeddedSnapshot.modelName;
          }
          return embeddedJson;
        });
      }
    },

    serializeHasManyUnembedded(snapshot, json, relationship){
      let key = relationship.key;
      let isPolymorphic = relationship.options.polymorphic;

      if (this._shouldSerializeHasMany(snapshot, key, relationship)) {
        var hasMany = snapshot.hasMany(key);
        if (hasMany !== undefined) {
          // if provided, use the mapping provided by `attrs` in
          // the serializer
          var payloadKey = this._getMappedKey(key, snapshot.type);
          if (payloadKey === key && this.keyForRelationship) {
            payloadKey = this.keyForRelationship(key, "hasMany", "serialize");
          }

          var hasManyContent;
          if(isPolymorphic){
            //payload will be an array of objects with ids and types
            hasManyContent = hasMany.map( snapshot => {
              return { id: snapshot.id, type: snapshot.modelName };
            });
          } else {
            //payload will be an array of ids
            hasManyContent = hasMany.map( snapshot => {
              return snapshot.id;
            });
          }
          json[payloadKey] = hasManyContent;

        }
      }
    },

    serializeBelongsTo(snapshot, json, relationship){
      var attr = relationship.key;
      let isPolymorphic = relationship.options.polymorphic;

      if (this.noSerializeOptionSpecified(attr)) {
        this.serializeBelongsToUnembedded(snapshot, json, relationship);
        return;
      }
      var includeIds = this.hasSerializeIdsOption(attr);
      var includeRecords = this.hasSerializeRecordsOption(attr);
      var embeddedSnapshot = snapshot.belongsTo(attr);
      var key;
      if (includeIds) {
        key = this.keyForRelationship(attr, relationship.kind, 'serialize');
        if (!embeddedSnapshot) {
          json[key] = null;
        } else {
          if(isPolymorphic){
            json[key] = {id:embeddedSnapshot.id, type:embeddedSnapshot.modelName};
          } else {
            json[key] = embeddedSnapshot.id;
          }
        }
      } else if (includeRecords) {
        key = this.keyForAttribute(attr, 'serialize');
        if (!embeddedSnapshot) {
          json[key] = null;
        } else {
          if(isPolymorphic){
            embeddedSnapshot['type'] = embeddedSnapshot.modelName;
          }
          json[key] = embeddedSnapshot.record.serialize({ includeId: true });
          this.removeEmbeddedForeignKey(snapshot, embeddedSnapshot, relationship, json[key]);
        }
      }
    },

    serializeBelongsToUnembedded(snapshot, json, relationship){
      let key = relationship.key;
      let isPolymorphic = relationship.options.polymorphic;

      if (this._canSerialize(key)) {
        var belongsTo = snapshot.belongsTo(key);

        // if provided, use the mapping provided by `attrs` in
        // the serializer
        var payloadKey = this._getMappedKey(key, snapshot.type);
        if (payloadKey === key && this.keyForRelationship) {
          payloadKey = this.keyForRelationship(key, "belongsTo", "serialize");
        }

        if (Ember.isNone(belongsTo)) {
          //Need to check whether the id is there for new&async records
          json[payloadKey] = null;
        } else if(isPolymorphic) {
          json[payloadKey] = { id: belongsTo.id, type: belongsTo.modelName };
        } else {
          json[payloadKey] = belongsTo.id;
        }
      }
    }
});
