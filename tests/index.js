const expect = require('chai').expect;
const TreeSync = require('../');
const quickTemp = require('quick-temp');
const walkSync = require('walk-sync');
const fs = require('fs');
const path = require('path');

function expectMode(entry, prop,  mode) {
  if (process.platform === 'win32') { return; }
  expect(entry).to.have.deep.property(prop, mode);
}

const waitAsync = async (ms) => new Promise(r => setTimeout(r, ms));

const sourcePath = __dirname + '/fixtures/';

describe('TreeSync', function() {
  let tmp;

  beforeEach(function() {
    tmp = quickTemp.makeOrRemake(this, 'tmpDestDir');
  });

  afterEach(function() {
    quickTemp.remove(this, 'tmpDestDir');
  });

  describe('fixtures/one', function() {
    let treeSync;

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

        const entries = walkSync.entries(tmp);
        const originalEntries = walkSync.entries(sourcePath);

        for (let i = 0, len = entries.length; i < len; i++) {
          const entry = entries[i];

          if (fs.statSync(path.join(entry.basePath, entry.relativePath)).isDirectory())
            continue;

          const originalEntry = originalEntries
            .find(x => x.relativePath === entry.relativePath);

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
      const newFolderPath = __dirname + '/fixtures/two';

      beforeEach(function() {
        fs.mkdirSync(newFolderPath);
        treeSync.sync(); // setup initialk
      });

      beforeEach(function() {
        fs.rmdirSync(newFolderPath);
      });

      it('immediately reflects deletions', function() {
        let beforeTree = walkSync(tmp);
        expect(beforeTree).to.deep.equal([
          'one/',
          'one/bar/',
          'one/bar/bar.txt',
          'one/foo.txt',
          'two/'
        ]);

        treeSync.sync();
        let afterTree = walkSync(tmp);

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

      it('has stable output (mtime, size, mode, relativePath)', async () => {
        let beforeTree = walkSync.entries(tmp);

        expect(beforeTree.length).to.eql(4);

        await waitAsync(10);

        // build a new `TreeSync` that does not have `lastInput` populated
        treeSync = new TreeSync(sourcePath, tmp);
        treeSync.sync();

        let afterTree = walkSync.entries(tmp);

        expect(afterTree.length).to.eql(4);
        expect(beforeTree).to.deep.equal(afterTree);
      });
    });

    describe('.sync', function() {
      it('returns a list of changed files', function() {
        let beforeTree = walkSync.entries(tmp);

        expect(beforeTree.length).to.eql(0);

        let changes = treeSync.sync();

        expect(changes).to.eql([
          ['mkdir',   'one/'],
          ['mkdir',   'one/bar/'],
          ['create',  'one/bar/bar.txt'],
          ['create',  'one/foo.txt']
        ]);
      });
    });

    describe('input(same) -> input(same + newFile)', function() {
      let newFilePath = __dirname + '/fixtures/one/added-file.js';

      beforeEach(function() {
        treeSync.sync(); // setup initial
      });

      afterEach(function() {
        fs.unlinkSync(newFilePath);
      });

      it('has stable output (mtime, size, mode, relativePath)', function() {
        let beforeTree = walkSync.entries(tmp);

        expect(beforeTree.length).to.eql(4);

        fs.writeFileSync(newFilePath, 'OMG', { mode: 33152 } ); // add file
        treeSync.sync();

        let afterTree = walkSync.entries(tmp);

        expect(afterTree.length).to.eql(5);
        expect(beforeTree).to.not.deep.equal(afterTree);

        let addedEntry = afterTree.find(entry => entry['relativePath'] === 'one/added-file.js');

        expectMode(addedEntry, 'mode', 33152);
        expect(addedEntry).to.have.property('relativePath', 'one/added-file.js');

        treeSync.sync();

        expect(afterTree).to.deep.equal(walkSync.entries(tmp));
      });
    });

    describe('output populated -> input with a changed file', function() {
      const changeFilePath = __dirname + '/fixtures/one/foo.txt';
      let originalValue, initialTree;

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
        let afterTree = walkSync.entries(tmp);

        // tree should be updated with OMG in one/foo.txt
        expect(initialTree).to.not.deep.equal(afterTree);

        let contents = fs.readFileSync(tmp + '/one/foo.txt', { encoding: 'utf8'} );
        expect(contents).to.equal('OMG');

        // sync again to ensure stablity after synced
        treeSync.sync();

        expect(afterTree).to.deep.equal(walkSync.entries(tmp));
      });
    });

    describe('input(same) -> input(same - file)', function() {
      const removedFilePath = __dirname + '/fixtures/one/foo.txt';
      let removedFileContent = fs.readFileSync(removedFilePath);
      let removedFileStat = fs.statSync(removedFilePath);

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
        let entries = walkSync.entries(tmp);

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
