import EditorManager from '@wiz/service/editor';
import { OnInit, Input } from '@angular/core';
import toastr from "toastr";

import InfoEditor from "@wiz/app/season.route.info";
import MonacoEditor from "@wiz/app/season.monaco";

toastr.options = {
    "closeButton": false,
    "debug": false,
    "newestOnTop": true,
    "progressBar": false,
    "positionClass": "toast-bottom-right",
    "preventDuplicates": true,
    "onclick": null,
    "showDuration": 300,
    "hideDuration": 500,
    "timeOut": 1500,
    "extendedTimeOut": 1000,
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
};

export class Component implements OnInit {
    @Input() scope: any;

    APP_ID: string = wiz.namespace;
    public keyword: string = "";
    public categories: Array<string> = [];
    public routes: any = {};

    constructor(private editorManager: EditorManager) {
    }

    public async ngOnInit() {
        await this.load();
    }

    public active(item: EditorManager.Editor) {
        let em = this.editorManager;
        if (!em.activated) return '';
        if (this.APP_ID != em.activated.component_id) return '';
        if (item.id != em.activated.meta.id) return '';
        return 'active';
    }

    public async match(item: EditorManager.Editor) {
        if (item.title.toLowerCase().indexOf(this.keyword.toLowerCase()) >= 0) {
            return true;
        }
        if (item.subtitle.toLowerCase().indexOf(this.keyword.toLowerCase()) >= 0) {
            return true;
        }
        return false;
    }

    public async load() {
        let { data } = await wiz.call("list");
        let apps: any = {};
        let categories: any = [];
        for (let i = 0; i < data.length; i++) {
            let app = data[i];
            let category = app.category;
            if (!category) category = 'undefined';
            if (!apps[category]) {
                apps[category] = [];
                if (categories.indexOf(category) < 0)
                    categories.push(category)
            }
            apps[category].push(app);
        }

        this.routes = apps;
        this.categories = categories;

        await this.scope.render();
    }

    private async update(path: string, data: string, viewuri: string | null = null) {
        let res = await wiz.call('update', { path: path, code: data });
        if (res.code == 200) toastr.success("Updated");
        await this.load();
        if (!viewuri) return;
        let binding = this.scope.binding.load("season.preview");
        if (binding) await binding.move(viewuri);
    }

    public async create() {
        // create editor
        let editor = this.editorManager.create({ component_id: this.APP_ID, title: 'New' });

        // create tab
        editor.create({ name: 'info', viewref: InfoEditor })
            .bind('data', async (tab) => {
                return { id: '', title: '', route: '', viewuri: '', category: '' };
            }).bind('update', async (tab) => {
                let data = await tab.data();
                let check = /^[a-z0-9.]+$/.test(data.id);
                if (!check) return toastr.error("invalidate id");
                if (data.id.length < 3) return toastr.error("id at least 3 alphabets");

                let id = data.id;
                let res = await wiz.call("exists", { id });
                if (res.data) return toastr.error("namespace already exists");

                data = JSON.stringify(data, null, 4);
                let path = "route/" + id + "/app.json";

                editor.close();
                await wiz.call('update', { path, code: data });
                await this.load();
            });

        await editor.open();
        await editor.activate();
    }

    public async open(app: any, location: number = -1) {
        let routepath = 'route/' + app.id;

        let editor = this.editorManager.create({
            component_id: this.APP_ID,
            path: routepath,
            title: app.title ? app.title : app.id,
            subtitle: app.route,
            current: 1
        });

        // create tab
        editor.create({
            name: 'info',
            viewref: InfoEditor,
            path: routepath + "/app.json"
        }).bind('data', async (tab) => {
            let { code, data } = await wiz.call('data', { path: tab.path });
            if (code != 200) return {};
            editor.meta.id = JSON.parse(data).id;
            data = JSON.parse(data);
            return data;
        }).bind('update', async (tab) => {
            let data = await tab.data();
            let viewuri = data.viewuri;

            let check = /^[a-z0-9.]+$/.test(data.id);
            if (!check) return toastr.error("invalidate id");
            if (data.id.length < 3) return toastr.error("id at least 3 alphabets");

            let from = editor.meta.id;
            let to = data.id;

            // if moved
            if (from != to) {
                let res = await wiz.call("move", { from, to });
                if (res.code == 400) {
                    toastr.error("invalidate namespace");
                    return;
                }
            }

            editor.modify({ path: 'route/' + to, title: data.title ? data.title : data.id, subtitle: data.route, meta: { id: to } });

            for (let i = 0; i < editor.tabs.length; i++) {
                let topath: any = editor.tabs[i].path + '';
                topath = topath.split("/");
                topath[1] = to;
                topath = topath.join("/");
                editor.tabs[i].move(topath);
            }

            data = JSON.stringify(data, null, 4);
            await this.update(editor.path + '/app.json', data, viewuri);
        });

        editor.create({
            name: 'Controller',
            viewref: MonacoEditor,
            path: routepath + "/controller.py",
            config: { monaco: { language: 'python' } }
        }).bind('data', async (tab) => {
            tab.meta.info = await editor.tab(0).data();
            let { code, data } = await wiz.call('data', { path: tab.path });
            if (code != 200) return {};
            return { data };
        }).bind('update', async (tab) => {
            let data = await tab.data();
            await this.update(tab.path, data.data, tab.meta.info ? tab.meta.info.viewuri : null);
        });

        editor.bind("delete", async () => {
            let targets = await this.editorManager.find(editor);
            for (let i = 0; i < targets.length; i++)
                await targets[i].close();
            await wiz.call("remove", { path: editor.path });
            await this.load();
        });

        await editor.open(location);
        await editor.activate();
    }

}