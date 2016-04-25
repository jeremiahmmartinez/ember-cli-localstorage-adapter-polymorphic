import DS from 'ember-data';
import LSAdapter from 'ember-cli-localstorage-adapter/localstorage-adapter';

var namespace = (typeof Drupal.settings.proSlider.adminSettings !== 'undefined') ? Drupal.settings.proSlider.adminSettings.namespace : 'proslider';

var ApplicationAdapter = LSAdapter.extend({
  namespace: namespace,

  shouldBackgroundReloadRecord: function (store, snapshot) {
    return false;
  },

  findRecord: function(store, type, id, opts) {
    var allowRecursive = true;

    //Changed:
    //if id is object {id: 'id', type: 'type'}
    if (typeof id == 'object'){
      var namespace = this._namespaceForType(store.modelFor(id.type));
      var record = Ember.A(namespace.records[id.id]);
    }
    //otherwise, if is string/integer
    else {
      var namespace = this._namespaceForType(type);
      var record = Ember.A(namespace.records[id]);
    }

    /**
     * In the case where there are relationships, this method is called again
     * for each relation. Given the relations have references to the main
     * object, we use allowRecursive to avoid going further into infinite
     * recursiveness.
     *
     * Concept from ember-indexdb-adapter
     */
    if (opts && typeof opts.allowRecursive !== 'undefined') {
      allowRecursive = opts.allowRecursive;
    }

    if (!record || !record.hasOwnProperty('id')) {
      return Ember.RSVP.reject(new Error("Couldn't find record of" + " type '" + type.modelName + "' for the id '" + id + "'."));
    }

    if (allowRecursive) {
      return this.loadRelationships(store, type, record);
    } else {
      return Ember.RSVP.resolve(record);
    }
  },

  /**
   * This takes a record, then analyzes the model relationships and replaces
   * ids with the actual values.
   *
   * Stolen from ember-indexdb-adapter
   *
   * Consider the following JSON is entered:
   *
   * ```js
   * {
   *   "id": 1,
   *   "title": "Rails Rambo",
   *   "comments": [1, 2]
   * }
   *
   * This will return:
   *
   * ```js
   * {
   *   "id": 1,
   *   "title": "Rails Rambo",
   *   "comments": [1, 2]
   *
   *   "_embedded": {
   *     "comment": [{
   *       "_id": 1,
   *       "comment_title": "FIRST"
   *     }, {
   *       "_id": 2,
   *       "comment_title": "Rails is unagi"
   *     }]
   *   }
   * }
   *
   * This way, whenever a resource returned, its relationships will be also
   * returned.
   *
   * @method loadRelationships
   * @private
   * @param {DS.Model} type
   * @param {Object} record
   */
  loadRelationships: function(store, type, record) {
    var adapter = this,
      resultJSON = {},
      modelName = type.modelName,
      relationshipNames, relationships,
      relationshipPromises = [];

    /**
     * Create a chain of promises, so the relationships are
     * loaded sequentially.  Think of the variable
     * `recordPromise` as of the accumulator in a left fold.
     */
    var recordPromise = Ember.RSVP.resolve(record);

    relationshipNames = Ember.get(type, 'relationshipNames');
    relationships = relationshipNames.belongsTo
      .concat(relationshipNames.hasMany);

    relationships.forEach(function(relationName) {
      var relationModel = type.typeForRelationship(relationName, store);
      var relationEmbeddedId = record[relationName];
      var relationProp = adapter.relationshipProperties(type, relationName);
      var relationType = relationProp.kind;
      var foreignAdapter = store.adapterFor(relationModel.modelName);

      var opts = {
        allowRecursive: false
      };

      /**
       * embeddedIds are ids of relations that are included in the main
       * payload, such as:
       *
       * {
       *    cart: {
       *      id: "s85fb",
       *      customer: "rld9u"
       *    }
       * }
       *
       * In this case, cart belongsTo customer and its id is present in the
       * main payload. We find each of these records and add them to _embedded.
       */
      //if (relationEmbeddedId && DS.LSAdapter.prototype.isPrototypeOf(adapter)) {
      if (relationEmbeddedId) {
        recordPromise = recordPromise.then(function(recordPayload) {
          var promise;
          if (relationType === 'belongsTo' || relationType === 'hasOne') {
            //Changed:
            //store is needed to get proper namespace
            promise = adapter.findRecord(store, relationModel, relationEmbeddedId, opts);
          } else if (relationType == 'hasMany') {
            //Changed:
            //store is needed to get proper namespace
            promise = adapter.findMany(store, relationModel, relationEmbeddedId, opts);
          }

          return promise.then(function(relationRecord) {
            return adapter.addEmbeddedPayload(recordPayload, relationName, relationRecord);
          });
        });
      }
    });

    return recordPromise;
  },

  findMany: function(store, type, ids, opts) {
    var namespace = this._namespaceForType(type);
    var adapter = this,
      allowRecursive = true,
        results = [],
          record;

          /**
           * In the case where there are relationships, this method is called again
           * for each relation. Given the relations have references to the main
           * object, we use allowRecursive to avoid going further into infinite
           * recursiveness.
           *
           * Concept from ember-indexdb-adapter
           */
          if (opts && typeof opts.allowRecursive !== 'undefined') {
            allowRecursive = opts.allowRecursive;
          }

          for (var i = 0; i < ids.length; i++) {
            //Changed:
            // if ids[i] is object {id: 'id', type: 'type'}
            if (typeof ids[i] == 'object'){
              var namespace = this._namespaceForType(store.modelFor(ids[i].type));

              record = namespace.records[ids[i].id];
            }
            //Otherwise, if id is a string/integer
            else {
              record = namespace.records[ids[i]];
            }
            if (!record || !record.hasOwnProperty('id')) {
              return Ember.RSVP.reject(new Error("Couldn't find record of type '" + type.modelName + "' for the id '" + ids[i] + "'."));
            } else {
              results.push(Ember.copy(record));
            }
          }

          if (results.get('length') && allowRecursive) {
            return this.loadRelationshipsForMany(store, type, results);
          } else {
            return Ember.RSVP.resolve(results);
          }
  }
});

export default ApplicationAdapter;

//export { default } from 'ember-local-storage/adapters/adapter';
