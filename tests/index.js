var expect = require('chai').expect;
var TreeSync = require('../');
var quickTemp = require('quick-temp');
var walkSync = require('walk-sync');
var fs = require('fs');
var path = require('path');

function expectMode(entry, prop,  mode) {
  if (process.platform === 'win32') { return; }
  expect(entry).to.have.deep.property(prop, mode);
}

var sourcePath = __dirname + '/fixtures/';

describe('TreeSync', function() {
  var tmp;

  beforeEach(function() {
    tmp = quickTemp.makeOrRemake(this, 'tmpDestDir');
  });

  afterEach(function() {
    quickTemp.remove(this, 'tmpDestDir');
  });

  describe('fixtures/one', function() {
    var treeSync;

    beforeEach(function() {
      treeSync = new TreeSync(sourcePath, tmp);
    });

    describe('nothing -> populated', function() {
      it('file content', function() {
        expect(walkSync(tmp)).to.deep.equal([]);

        treeSync.sync();

        expect(walkSync(tmp)).to.deep.equal([
          'one/',
          'one/bar/',
          'one/bar/bar.txt',
          'one/foo.txt'
        ]);
      });

      it('validate mtime stays the same', function() {
        treeSync = new TreeSync(sourcePath, tmp);
        treeSync.sync();
        
        var entries = walkSync.entries(tmp);
        var originalEntries = walkSync.entries(sourcePath);

        for (var i = 0, len = entries.length; i < len; i++) {
          var entry = entries[i];

          if (fs.statSync(path.join(entry.basePath, entry.relativePath)).isDirectory())
            continue;

          var originalEntry = originalEntries
            .filter(function (x) { return x.relativePath === entry.relativePath; })[0];
          
          expect(entry.mtime).to.equal(originalEntry.mtime);
        }
      });
    });

    describe('existing empty directory -> populated', function() {
      it('file content', function() {
        expect(walkSync(tmp)).to.deep.equal([]);

        fs.mkdirSync(tmp + '/one');

        treeSync.sync();

        expect(walkSync(tmp)).to.deep.equal([
          'one/',
          'one/bar/',
          'one/bar/bar.txt',
          'one/foo.txt'
        ]);
      });
    });

    describe('rmdir operation is sync', function() {
      var newFolderPath = __dirname + '/fixtures/two';

      beforeEach(function() {
        fs.mkdirSync(newFolderPath);
        treeSync.sync(); // setup initialk
      });

      beforeEach(function() {
        fs.rmdirSync(newFolderPath);
      });

      it('immediately reflects deletions', function() {
        var beforeTree = walkSync(tmp);
        expect(beforeTree).to.deep.equal([
          'one/',
          'one/bar/',
          'one/bar/bar.txt',
          'one/foo.txt',
          'two/'
        ]);

        treeSync.sync();
        var afterTree = walkSync(tmp);

        expect(afterTree).to.deep.equal([
          'one/',
          'one/bar/',
          'one/bar/bar.txt',
          'one/foo.txt'
        ]);
      });
    });

    describe('input(same) -> input(same)', function() {
      beforeEach(function() {
        treeSync.sync(); // setup initial
      });

      it('has stable output (mtime, size, mode, relativePath)', function(cb) {
        var beforeTree = walkSync.entries(tmp);

        expect(beforeTree.length).to.eql(4);

        setTimeout(function () {
          // build a new `TreeSync` that does not have `lastInput` populated
          treeSync = new TreeSync(sourcePath, tmp);
          treeSync.sync();
  
          var afterTree = walkSync.entries(tmp);
  
          expect(afterTree.length).to.eql(4);
          expect(beforeTree).to.deep.equal(afterTree);

          cb();
        }, 10);
      });
    });

    describe('.sync', function() {
      it('returns a list of changed files', function() {
        var beforeTree = walkSync.entries(tmp);

        expect(beforeTree.length).to.eql(0);

        var changes = treeSync.sync();

        expect(changes).to.eql([
          ['mkdir',   'one/'],
          ['mkdir',   'one/bar/'],
          ['create',  'one/bar/bar.txt'],
          ['create',  'one/foo.txt']
        ]);
      });
    });

    describe('input(same) -> input(same + newFile)', function() {
      var newFilePath = __dirname + '/fixtures/one/added-file.js';

      beforeEach(function() {
        treeSync.sync(); // setup initial
      });

      afterEach(function() {
        fs.unlinkSync(newFilePath);
      });

      it('has stable output (mtime, size, mode, relativePath)', function() {
        var beforeTree = walkSync.entries(tmp);

        expect(beforeTree.length).to.eql(4);

        fs.writeFileSync(newFilePath, 'OMG', { mode: 33152 } ); // add file
        treeSync.sync();

        var afterTree = walkSync.entries(tmp);

        expect(afterTree.length).to.eql(5);
        expect(beforeTree).to.not.deep.equal(afterTree);

        var addedEntry = afterTree.filter(function(entry) {
          return entry['relativePath'] === 'one/added-file.js';
        })[0];

        expectMode(addedEntry, 'mode', 33152);
        expect(addedEntry).to.have.property('relativePath', 'one/added-file.js');

        treeSync.sync();

        expect(afterTree).to.deep.equal(walkSync.entries(tmp));
      });
    });

    describe('output populated -> input with a changed file', function() {
      var changeFilePath = __dirname + '/fixtures/one/foo.txt';
      var originalValue, initialTree;

      beforeEach(function() {
        originalValue = fs.readFileSync(changeFilePath, { encoding: 'utf8' });

        // populate tmp simulating a pre-existing output
        treeSync.sync();

        // grab state of `tmp` after initial sync
        initialTree = walkSync.entries(tmp);

        // change a file in the input tree
        fs.writeFileSync(changeFilePath, 'OMG');

        // build a new `TreeSync` that does not have `lastInput` populated
        treeSync = new TreeSync(sourcePath, tmp);

        treeSync.sync();
      });

      afterEach(function() {
        originalValue = fs.writeFileSync(changeFilePath, originalValue, { encoding: 'utf8' });
      });

      it('should update changed files on initial build', function() {
        var afterTree = walkSync.entries(tmp);

        // tree should be updated with OMG in one/foo.txt
        expect(initialTree).to.not.deep.equal(afterTree);

        var contents = fs.readFileSync(tmp + '/one/foo.txt', { encoding: 'utf8'} );
        expect(contents).to.equal('OMG');

        // sync again to ensure stablity after synced
        treeSync.sync();

        expect(afterTree).to.deep.equal(walkSync.entries(tmp));
      });
    });

    describe('input(same) -> input(same - file)', function() {
      var removedFilePath = __dirname + '/fixtures/one/foo.txt';
      var removedFileContent = fs.readFileSync(removedFilePath);
      var removedFileStat = fs.statSync(removedFilePath);

      beforeEach(function() {
        treeSync.sync();                // setup initial
        fs.unlinkSync(removedFilePath); // remove file
        treeSync.sync();                // re-sync to apply change
      });

      afterEach(function() {
        fs.writeFileSync(removedFilePath, removedFileContent);
        fs.utimesSync(removedFilePath, removedFileStat.atime, removedFileStat.mtime);
      });

      it('has stable output (mtime, size, mode, relativePath)', function() {
        var entries = walkSync.entries(tmp);

        expect(entries).to.have.deep.property('0.relativePath', 'one/');

        expectMode(entries, '0.mode', 16877);

        expect(entries).to.have.deep.property('1.relativePath', 'one/bar/');
        expectMode(entries, '1.mode', 16877);

        expect(entries).to.have.deep.property('2.relativePath', 'one/bar/bar.txt');
        expectMode(entries, '2.mode', 33188);

        expect(entries.length).to.eql(3);
      });
    });

    describe('validate walk-sync options', function() {
      it('should ignore files/folders it is told to ignore', function() {
        // Start with an empty dir
        expect(walkSync(tmp)).to.deep.equal([]);

        // We need our own treeSync instance with options
        treeSync = new TreeSync(sourcePath, tmp, {
          ignore: ['**/bar']
        });

        treeSync.sync();

        expect(walkSync(tmp)).to.deep.equal([
          'one/',
          'one/foo.txt'
        ]);
      });

      it('should only include globs it is told to include', function() {
        expect(walkSync(tmp)).to.deep.equal([]);

        treeSync = new TreeSync(sourcePath, tmp, {
          globs: ['one', 'one/foo.txt']
        });

        treeSync.sync();

        expect(walkSync(tmp)).to.deep.equal([
          'one/',
          'one/foo.txt'
        ]);
      });
    });
  });
});
