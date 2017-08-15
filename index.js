import net from 'net'
import cmap from 'colormap'
import {h, render, Component, Text} from 'ink'
import TextInput from 'ink-text-input'
import isRegexp from 'is-regexp'
import format from 'fmt-obj'


const NUM_SHADES = 24
const SHADE_STEP = 5
const SHADE_OFFSET = 2


const colormap = cmap({
  colormap: 'rainbow-soft',
  nshades: NUM_SHADES,
  format: 'hex'
})




const LOG_LEVELS = {
  DEBUG: 1,
  LOG: 2,
  INFO: 3,
  WARN: 4,
  ERROR: 5
}

let filter = /.*/

const Assert = props => (
	<Text keyword={props.value === true ? 'green' : 'red'}>{props.children}</Text>
)

const Error = props => (
	<div>
		<Text bgKeyword="red" bold>{props.children}</Text>
	</div>
)

const Warn = props => (
	<Text bgKeyword="yellow">{props.children}</Text>
)

const Log = props => (
	<Text keyword="white">{props.children}</Text>
)

const LogLine = props => {
	const color =  {hex: colormap[props.colorIndex]}
	const {payload} = props

	return (
		<div>
			<div>
				{
					props.label.map( lbl => (
						<span>
							<Text hex="#ffffff" >{lbl}</Text>
							<Text {...color} > ≫ </Text>
						</span>
					))
				}
				<Text hex="#ffffff">{props.reason}</Text>
			</div>
			{
				payload.length ? (
					<div>
						<Text hex="#ffffff">{payload}</Text>
					</div>
				) : (null)
			}
			<Text dim>
				-------------------------------------------------------------------------------
			</Text>
		</div>
	)
}



const loggers = new Map()
const createLogger = _ => ({
	id: 1000,
	baseLoggerID: Number.MAX_VALUE - loggers.size,
	label: 'remark',
	parentPath: [],
	enabled: true
})
const addLogger = logger => {
	logger.baseLoggerID = logger.parentPath.length ? logger.parentPath[0] : logger.id
	logger.extendedLabel = [...logger.parentPath.map(p => loggers.get(p.id).label), logger.label]
	logger.colorIndex = (logger.baseLoggerID * SHADE_STEP + SHADE_OFFSET) % NUM_SHADES
	loggers.set(logger.id, logger)
	return logger
}
const tlogger = createLogger()
const remark = addLogger(tlogger)

const log = (reason, payload = '') => ({
	loggerID: 1000,
	level: LOG_LEVELS.LOG,
	label:[remark.label],
	testLabel: remark.label,
	reason,
	payload
})

const err = (reason, ...error) => ({
	loggerID: 1000,
	level: LOG_LEVELS.ERROR,
	label:[remark.label],
	testLabel: remark.label,
	reason,
	payload: error
})




loggers.set()
const allowAll = new RegExp(/.*/)
class Logger extends Component {
	state = {
		logs: [],
		connectionStatus: 'false',
		inputValue: '',
		filter: allowAll,
		filtered: false,
		validFilter: true
	}

  componentDidMount() {
    var server = net.createServer(socket => {
			let messagePool = ''
      socket.on('data', message => {
				const msgs = `${messagePool}${message.toString()}`

				if(msgs.endsWith('\r\n')) {
					messagePool = ''
					const lines = msgs.split('\r\n').filter(m => m !== '')
					lines.forEach(line => {
						const msg = JSON.parse(line)
						const data = msg.data

						switch(msg.cmd) {
							case 'add':
								try {
									const logger = addLogger(data)
									this.addLog(log(`added logger [${logger.label}]`))
								} catch(e) {
									this.addLog(err('could not add logger:', e.message, e.stack))
								}
								break
							case 'log':
								this.addLog(msg.data)
								break
						}
					})
				} else {

					messagePool += msgs
					this.addLog(err('added to messagepool', messagePool))
				}
      })
			socket.on('disconnect', _ => {
				this.setState({logs:[]})
			})
    }).listen(3001, _ => {
			this.addLog(log('log server online'))
		});

    this.setState({connectionStatus: true})
  }
	onFilterChange(regex) {
		if(regex === '') {
			this.setState({filter: allowAll, filtered: false, inputValue: regex, validFilter: true})
		} else {
			try {
				const rgx = new RegExp(regex)
				this.setState({filter: rgx, inputValue: regex, validFilter: true, filtered: true})
			} catch(e) {
				this.setState({filter: allowAll, filtered: false, inputValue: regex, validFilter: false})
			}
		}
	}
	addLog(data) {
		let {logs} = this.state
		const logger = loggers.get(data.loggerID)

		const label = logger ? (logger.extendedLabel || [logger.label]) : [`LOGGER_WIIH_ID_${data.loggerID}`]
		const colorIndex = logger ? logger.colorIndex : 0
		const rawPayload = typeof data.payload === 'object' ?  JSON.stringify(data.payload): (data.payload || '')
		const payload = typeof data.payload === 'object' ?  format(data.payload, 	1).slice(0,1024) : (data.payload || '')

		const testable = `${label} ${data.reason} ${rawPayload}`



		const l = {...data, ...{label, colorIndex, testable, payload} }
		logs.push(l)
		const sliceparts = logs.length > 100 && [logs.length - 100, logs.length]
		this.setState({logs})
	}
	render(props, state) {

    const filtered = state.filtered ? state.logs.filter(l => state.filter.test(l.testable)) : state.logs
		const logs = filtered.length > 10 ? filtered.slice(filtered.length - 10, filtered.length) : filtered
		return (
			<div>
				<div>
					<span>
						{
							logs.length ?
								logs.map( log => ( <LogLine {...log} />)) :
								(<LogLine label={[remark.label]} reason={'No Logs Match Filter Criteria'} payload="" colorIndex={remark.colorIndex}/>)
						}

					</span>
				</div>
				<div>
					<Text white>Filter</Text>
					<Text bold magenta> ❯ </Text>
					<TextInput underline
						value={state.inputValue}
						onChange={regex => this.onFilterChange(regex)}
					/>
				</div>
			</div>
		)
	}
}

render(<Logger/>);
