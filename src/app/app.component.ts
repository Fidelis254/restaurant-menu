import { Component, Injectable } from '@angular/core';
import { FlatTreeControl } from '@angular/cdk/tree';
import { CollectionViewer, SelectionChange } from '@angular/cdk/collections';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { merge } from 'rxjs/observable/merge';
import { map } from 'rxjs/operators/map';
import { SelectionModel } from '@angular/cdk/collections';

/** Flat node with expandable and level information */
export class DynamicFlatNode {
  constructor(
    public item: string,
    public level: number = 1,
    public expandable: boolean = false,
    public isLoading: boolean = false
  ) {}
}

export class DynamicDatabase {
  dataMap = new Map([
    ['Salad', ['Santa Fe', 'Greek', 'Asian']],
    ['Entree', ['steak', 'Salmon', 'Rice']],

    [`Soup`, ['Minestrone', 'Hot and Sour', 'Miso']],
    ['Greek', ['Dressing', 'Bread']],
    ['Dressing', ['Italian', 'Blue Cheese', 'Ranch']],
    ['Minestrone', ['Bread']],
  ]);

  rootLevelNodes = ['Salad', 'Entree', 'Soup'];

  /** Initial data from database */
  initialData(): DynamicFlatNode[] {
    return this.rootLevelNodes.map(
      (name) => new DynamicFlatNode(name, 0, true)
    );
  }

  getChildren(node: string): string[] | undefined {
    return this.dataMap.get(node);
  }

  isExpandable(node: string): boolean {
    return this.dataMap.has(node);
  }
}
@Injectable()
export class DynamicDataSource {
  dataChange: BehaviorSubject<DynamicFlatNode[]> = new BehaviorSubject<
    DynamicFlatNode[]
  >([]);

  get data(): DynamicFlatNode[] {
    return this.dataChange.value;
  }
  set data(value: DynamicFlatNode[]) {
    this.treeControl.dataNodes = value;
    this.dataChange.next(value);
  }

  constructor(
    private treeControl: FlatTreeControl<DynamicFlatNode>,
    private database: DynamicDatabase
  ) {}

  connect(collectionViewer: CollectionViewer): Observable<DynamicFlatNode[]> {
    this.treeControl.expansionModel.onChange!.subscribe((change) => {
      if (
        (change as SelectionChange<DynamicFlatNode>).added ||
        (change as SelectionChange<DynamicFlatNode>).removed
      ) {
        this.handleTreeControl(change as SelectionChange<DynamicFlatNode>);
      }
    });

    return merge(collectionViewer.viewChange, this.dataChange).pipe(
      map(() => this.data)
    );
  }
  handleTreeControl(change: SelectionChange<DynamicFlatNode>) {
    if (change.added) {
      change.added.forEach((node) => this.toggleNode(node, true));
    }
    if (change.removed) {
      change.removed.reverse().forEach((node) => this.toggleNode(node, false));
    }
  }
  toggleNode(node: DynamicFlatNode, expand: boolean) {
    const children = this.database.getChildren(node.item);
    const index = this.data.indexOf(node);
    if (!children || index < 0) {
      return;
    }

    if (expand) {
      node.isLoading = true;

      setTimeout(() => {
        const nodes = children.map(
          (name) =>
            new DynamicFlatNode(
              name,
              node.level + 1,
              this.database.isExpandable(name)
            )
        );
        this.data.splice(index + 1, 0, ...nodes);
        this.dataChange.next(this.data);
        node.isLoading = false;
      }, 1000);
    } else {
      this.data.splice(index + 1, children.length);
      this.dataChange.next(this.data);
    }
  }
}

/**
 * @title Tree with dynamic data
 */
@Component({
  selector: 'material-app',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.css'],
  providers: [DynamicDatabase],
})
export class AppComponent {
  constructor(database: DynamicDatabase) {
    this.treeControl = new FlatTreeControl<DynamicFlatNode>(
      this.getLevel,
      this.isExpandable
    );
    this.dataSource = new DynamicDataSource(this.treeControl, database);

    this.dataSource.data = database.initialData();
  }

  treeControl: FlatTreeControl<DynamicFlatNode>;

  dataSource: DynamicDataSource;

  getLevel = (node: DynamicFlatNode) => {
    return node.level;
  };

  isExpandable = (node: DynamicFlatNode) => {
    return node.expandable;
  };

  hasChild = (_: number, _nodeData: DynamicFlatNode) => {
    return _nodeData.expandable;
  };
  checklistSelection = new SelectionModel<DynamicFlatNode>(true /* multiple */);
  descendantsPartiallySelected(node: DynamicFlatNode): boolean {
    console.log(node);
    const descendants = this.treeControl.getDescendants(node);
    const result = descendants.some((child) =>
      this.checklistSelection.isSelected(child)
    );
    return result && !this.descendantsAllSelected(node);
  }

  todoItemSelectionToggle(node: DynamicFlatNode): void {
    this.checklistSelection.toggle(node);
    const descendants = this.treeControl.getDescendants(node);
    this.checklistSelection.isSelected(node)
      ? this.checklistSelection.select(...descendants)
      : this.checklistSelection.deselect(...descendants);
    descendants.forEach((child) => this.checklistSelection.isSelected(child));
    //this.checkAllParentsSelection(node);
  }
  todoLeafItemSelectionToggle(node: DynamicFlatNode): void {
    this.checklistSelection.toggle(node);
    this.checkAllParentsSelection(node);
  }
  checkAllParentsSelection(node: DynamicFlatNode): void {
    let parent: DynamicFlatNode | null = this.getParentNode(node);
    while (parent) {
      this.checkRootNodeSelection(parent);
      parent = this.getParentNode(parent);
    }
  }
  getParentNode(node: DynamicFlatNode): DynamicFlatNode | null {
    const currentLevel = this.getLevel(node);

    if (currentLevel < 1) {
      return null;
    }

    const startIndex = this.treeControl.dataNodes.indexOf(node) - 1;

    for (let i = startIndex; i >= 0; i--) {
      const currentNode = this.treeControl.dataNodes[i];

      if (this.getLevel(currentNode) < currentLevel) {
        return currentNode;
      }
    }
    return null;
  }
  checkRootNodeSelection(node: DynamicFlatNode): void {
    const nodeSelected = this.checklistSelection.isSelected(node);
    const descendants = this.treeControl.getDescendants(node);
    const descAllSelected =
      descendants.length > 0 &&
      descendants.every((child) => {
        return this.checklistSelection.isSelected(child);
      });
    if (nodeSelected && !descAllSelected) {
      this.checklistSelection.deselect(node);
    } else if (!nodeSelected && descAllSelected) {
      this.checklistSelection.select(node);
    }
  }
  descendantsAllSelected(node: DynamicFlatNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const descAllSelected =
      descendants.length > 0 &&
      descendants.every((child) => {
        return this.checklistSelection.isSelected(child);
      });
    return descAllSelected;
  }
}
