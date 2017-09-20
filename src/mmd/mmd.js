//模块按需加载
//模块依赖管理
//CMD提前加载，延迟执行

window.cmd = {
  configMap: {
    RegExp: /require\("(.*)"\)/g // 依赖匹配正则
  },

  /**
   * 缓存模块对象
   */    
  Modules:{},

  /**
   * 入口方法
   * @param {Array} ids 入口模块路径数组
   * @param {Function} callback
   */
  use (ids, callback) {
    //并行加载入口模块
    Promise.all(
      ids.map(id => cmd.loader(id))
    ).then((list) => {
      //所有依赖加载完毕后执行回调函数
      if (typeof callback === "function") {
        callback.apply(window, list)
      }
    }).catch((err) => {
      console.log(err)
    })
  },

  /**
   * 模块加载
   * @param {String} id 模块路径
   * @returns {Promise}
   */
  loader (id) {
    return new Promise((resolve, reject) => {
      // 缓存中没有，则创建模块
      const mod = cmd.Modules[id] || moduleFactory.create(id)

      // 绑定 加载完成 事件
      mod.on('complete', () => {
        resolve(cmd.getModuleExports(mod))
      })

      // 绑定 加载失败 事件
      mod.on('error', reject)
    })
  },

  /**
   * 获取模块接口
   * @param {object} mod 模块对象
   * @returns {*}
   */
  getModuleExports (mod) {
    if (!mod.exports) {
      mod.exports = mod.factory(require, mod)
    }
    return mod.exports
  }

}

/**
 * define
 * @param {*} factory 
 */
const define = function(factory) {
  // 正则匹配factory，更新依赖项属性
  // 如果依赖项存在，则加载，后触发complete事件
  // 如果依赖项不存在，则触发complete事件
  const reg = /tests.*/g
  const str = factory.toString()
  const id = document.currentScript.src.match(reg)[0]
  const mol = cmd.Modules[id]
  const depended = []
  let match

  while (match = cmd.configMap.RegExp.exec(str)) {
    depended.push(match[1])
  }
    
  cmd.Modules[id].factory = factory
  cmd.Modules[id].dependences = depended

  if (depended.length > 0) {
    Promise.all(
      depended.map((id) => {
        return new Promise(function (resolve,reject) {
          const depMod = cmd.Modules[id] || moduleFactory.create(id)
          depMod.on('complete',resolve)
          depMod.on('error',reject)
        })
      })
    ).then(() => {
      //所有依赖模块加载完毕后，调用setStatus方法更改父模块状态为complete
      mol.setStatus("complete")
    }, (error) => {
      mol.setStatus("error",error)
    })
  } else {
    mol.setStatus("complete")
  }
}

/**
 * require
 * @param {String} id 模块路径
 * @returns {*}
 */
const require = function(id) {
  const mol = cmd.Modules[id]
  if (mol) {
    return cmd.getModuleExports(mol)
  } else {
    throw "not found module:" + id
  }
}


const moduleFactory = (function () {
  //模块被创建以后即开始load
  class Module {
    /**
     * Creates an instance of Module.
     * @param {String} id 模块路径
     * @memberof Module
     */
    constructor(id) {
      this.id = id
      this.status = 'pedding'
      this.dependences = null
      this.factory = null
      this.callback = {}
      this.load()
    }

    /**
     * 创建 script 标签，根据模块路径去异步加载
     * @memberof Module
     */
    load() {
      const script = document.createElement('script')
      script.src = this.id
      document.head.appendChild(script)
      this.status = 'loading'
    }

    on(event, callback) {
      if (event === 'complete' && this.status === 'complete') {
        callback(this)
      } else if (event === 'error' && this.status === 'error') {
        callback(this)
      } else {
        this.callback[event] = callback
      }
    }

    trigger(event) {
      if (event in this.callback) {
        const callback = this.callback[event]
        callback(this)
      } else {
        console.log('not found callback')
      }
    }

    setStatus(status) {
      // 状态改变，触发响应的事件
      if(this.status!==status){
        this.status=status;
        switch (status) {
          case "complete":
            this.trigger('complete')
            break
          case "error":
            this.trigger('error')
            break
          case "loading":
            this.trigger("loading")
            break
          default:
            break
        }
      }
    }
  }

  return {
    create(id) {
      const mol = new Module(id)
      cmd.Modules[id] = mol
      return mol
    }
  }
    
})()
