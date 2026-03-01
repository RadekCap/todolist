import { BaseModal } from './BaseModal.js'

/**
 * GTD status to GTD phase mapping
 * Maps app GTD statuses to the corresponding GTD methodology phase
 */
export const GTD_STATUS_PHASE_MAP = {
    'inbox': 'capture',
    'next_action': 'organize',
    'scheduled': 'organize',
    'waiting_for': 'organize',
    'someday_maybe': 'organize',
    'done': 'reflect',
    'all': 'capture'
}

/**
 * GtdGuideModal controller
 * Displays an interactive GTD methodology reference guide with 5 phases
 */
export class GtdGuideModal extends BaseModal {
    constructor(elements) {
        super(elements.modal, {
            closeButtons: [elements.closeBtn, elements.cancelBtn]
        })

        this.contentContainer = elements.contentContainer
        this.activePhase = 'capture'

        this.buildContent()
        this.initGuideListeners()
    }

    initGuideListeners() {
        // Tab switching via event delegation
        this.tabsContainer.addEventListener('click', (e) => {
            const tab = e.target.closest('.gtd-guide-tab')
            if (tab && tab.dataset.phase) {
                this.switchPhase(tab.dataset.phase)
            }
        })
    }

    open(phase = 'capture') {
        super.open()
        this.switchPhase(phase)
    }

    switchPhase(phase) {
        this.activePhase = phase

        // Update tabs
        this.tabsContainer.querySelectorAll('.gtd-guide-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.phase === phase)
        })

        // Update panels
        this.contentContainer.querySelectorAll('.gtd-guide-panel').forEach(panel => {
            panel.classList.toggle('visible', panel.dataset.phase === phase)
        })
    }

    buildContent() {
        this.contentContainer.innerHTML = `
            <div class="gtd-guide-tabs">
                <button class="gtd-guide-tab active" data-phase="capture">Capture</button>
                <button class="gtd-guide-tab" data-phase="clarify">Clarify</button>
                <button class="gtd-guide-tab" data-phase="organize">Organize</button>
                <button class="gtd-guide-tab" data-phase="reflect">Reflect</button>
                <button class="gtd-guide-tab" data-phase="engage">Engage</button>
            </div>

            <!-- CAPTURE -->
            <div class="gtd-guide-panel visible" data-phase="capture">
                <div class="gtd-guide-principle">
                    <strong>The Core Rule:</strong> If it's on your mind, it's not getting done.
                    Capture it externally so your mind is free to think, not to remember.
                </div>

                <div class="gtd-guide-cards">
                    <div class="gtd-guide-card" style="--card-accent: #6366f1;">
                        <h4>Physical Inbox</h4>
                        <p>Paper tray on your desk. Toss in mail, notes, receipts, printouts &mdash; anything physical that needs processing.</p>
                    </div>
                    <div class="gtd-guide-card" style="--card-accent: #6366f1;">
                        <h4>Digital Inbox</h4>
                        <p>A note-taking app, email inbox, or task app. Quick-capture thoughts, ideas, and commitments as they come.</p>
                    </div>
                    <div class="gtd-guide-card" style="--card-accent: #6366f1;">
                        <h4>Voice / On-the-go</h4>
                        <p>Voice memos, pocket notebook, phone camera. Capture in the moment so nothing slips through the cracks.</p>
                    </div>
                    <div class="gtd-guide-card" style="--card-accent: #6366f1;">
                        <h4>Triggers Checklist</h4>
                        <p>Walk through areas of life &amp; work to surface open loops: commitments, projects, waiting-fors, someday ideas.</p>
                    </div>
                </div>

                <div class="gtd-guide-principle">
                    <strong>Key Habits:</strong> Use as few inboxes as possible, but as many as needed.
                    Empty them regularly (in the Clarify phase). Never use your inbox as a to-do list.
                </div>
            </div>

            <!-- CLARIFY -->
            <div class="gtd-guide-panel" data-phase="clarify">
                <div class="gtd-guide-principle">
                    <strong>The Core Rule:</strong> Process top-down, one item at a time.
                    Never put anything back into your inbox &mdash; decide and move it.
                </div>

                <div class="gtd-guide-flowchart">
                    <div class="gtd-fc-box gtd-fc-start">Inbox Item</div>
                    <div class="gtd-fc-arrow-down"></div>
                    <div class="gtd-fc-box gtd-fc-question">What is it? What's the desired outcome?</div>
                    <div class="gtd-fc-arrow-down"></div>
                    <div class="gtd-fc-box gtd-fc-decision">Is it actionable?</div>

                    <div class="gtd-fc-branches">
                        <div class="gtd-fc-branch">
                            <div class="gtd-fc-branch-label gtd-fc-no">No</div>
                            <div class="gtd-fc-branch-items">
                                <div class="gtd-fc-box gtd-fc-result gtd-fc-trash">Trash<span>Delete it</span></div>
                                <div class="gtd-fc-box gtd-fc-result gtd-fc-reference">Reference<span>File it away</span></div>
                                <div class="gtd-fc-box gtd-fc-result gtd-fc-someday">Someday / Maybe<span>Incubate for later</span></div>
                            </div>
                        </div>
                        <div class="gtd-fc-branch">
                            <div class="gtd-fc-branch-label gtd-fc-yes">Yes</div>
                            <div class="gtd-fc-branch-items">
                                <div class="gtd-fc-box gtd-fc-decision gtd-fc-decision-small">Multi-step outcome?</div>
                                <div class="gtd-fc-subbranch">
                                    <div class="gtd-fc-box gtd-fc-result gtd-fc-project">Yes &rarr; Project<span>Add to Projects list, then define next action</span></div>
                                    <div class="gtd-fc-box gtd-fc-result gtd-fc-single">No &rarr; Single action</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="gtd-fc-arrow-down gtd-fc-arrow-spaced"></div>
                    <div class="gtd-fc-box gtd-fc-decision">What's the next action?</div>

                    <div class="gtd-fc-actions">
                        <div class="gtd-fc-box gtd-fc-result gtd-fc-do">
                            <strong>&lt; 2 min</strong>
                            Do It Now
                            <span>Just get it done</span>
                        </div>
                        <div class="gtd-fc-box gtd-fc-result gtd-fc-delegate">
                            <strong>Not me</strong>
                            Delegate
                            <span>Waiting-for list</span>
                        </div>
                        <div class="gtd-fc-box gtd-fc-result gtd-fc-defer">
                            <strong>&gt; 2 min</strong>
                            Defer
                            <span>Calendar or Next Actions</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ORGANIZE -->
            <div class="gtd-guide-panel" data-phase="organize">
                <div class="gtd-guide-principle">
                    <strong>The Core Rule:</strong> Organize by <em>action required</em>, not by topic or priority.
                    The categories below are all you need.
                </div>

                <div class="gtd-guide-list-cards">
                    <div class="gtd-guide-list-card" style="--list-accent: #818cf8;">
                        <h4>Projects List</h4>
                        <ul>
                            <li>Any outcome requiring 2+ actions</li>
                            <li>Define the desired outcome clearly</li>
                            <li>Every project must have a next action</li>
                            <li>Review weekly to keep current</li>
                        </ul>
                    </div>
                    <div class="gtd-guide-list-card" style="--list-accent: #10b981;">
                        <h4>Next Actions</h4>
                        <ul>
                            <li>The very next physical, visible step</li>
                            <li>Organized by <strong>context</strong></li>
                            <li>@Computer, @Phone, @Office</li>
                            <li>@Errands, @Home, @Anywhere</li>
                        </ul>
                    </div>
                    <div class="gtd-guide-list-card" style="--list-accent: #f59e0b;">
                        <h4>Waiting For</h4>
                        <ul>
                            <li>Delegated actions you're tracking</li>
                            <li>Record what, to whom, and when</li>
                            <li>Follow up during weekly review</li>
                            <li>Move to Next Actions when returned</li>
                        </ul>
                    </div>
                    <div class="gtd-guide-list-card" style="--list-accent: #ef4444;">
                        <h4>Calendar</h4>
                        <ul>
                            <li>Date-specific actions only (hard landscape)</li>
                            <li>Day-specific information</li>
                            <li>Time-specific appointments</li>
                            <li>Do NOT use as a wish list</li>
                        </ul>
                    </div>
                    <div class="gtd-guide-list-card" style="--list-accent: #7c3aed;">
                        <h4>Someday / Maybe</h4>
                        <ul>
                            <li>Ideas you're not committed to yet</li>
                            <li>Books, trips, skills, projects to consider</li>
                            <li>"Parking lot" for creative ideas</li>
                            <li>Review regularly &mdash; activate or drop</li>
                        </ul>
                    </div>
                    <div class="gtd-guide-list-card" style="--list-accent: #2563eb;">
                        <h4>Reference</h4>
                        <ul>
                            <li>Non-actionable but useful information</li>
                            <li>Files, articles, manuals, contacts</li>
                            <li>Must be easily retrievable</li>
                            <li>General or topic-specific filing</li>
                        </ul>
                    </div>
                </div>

                <div class="gtd-guide-principle">
                    <strong>Project Support Material:</strong> Plans, notes, research, and other material for active projects.
                    Keep separate from actions and reference. Organize per-project, not per-topic.
                </div>
            </div>

            <!-- REFLECT -->
            <div class="gtd-guide-panel" data-phase="reflect">
                <div class="gtd-guide-principle">
                    <strong>The Core Rule:</strong> Regularly step back to keep your system
                    <em>current, complete, and trustworthy</em>. The Weekly Review is the critical success factor of GTD.
                </div>

                <div class="gtd-guide-principle" style="--principle-accent: #f59e0b;">
                    <strong>Daily Review:</strong> Check your <strong>calendar</strong> for hard commitments.
                    Scan your <strong>Next Actions</strong> lists by context. Adapt as the day evolves.
                </div>

                <h3 class="gtd-guide-section-title">The Weekly Review <span class="gtd-guide-subtitle">(~1-2 hours)</span></h3>

                <div class="gtd-guide-review-steps">
                    <div class="gtd-guide-review-step">
                        <div class="gtd-guide-step-number">1</div>
                        <div class="gtd-guide-step-content">
                            <h4>Get Clear</h4>
                            <p>Collect loose papers &amp; materials. Empty all inboxes (email, notes, voicemail). Process every item to zero.</p>
                        </div>
                    </div>
                    <div class="gtd-guide-review-step">
                        <div class="gtd-guide-step-number">2</div>
                        <div class="gtd-guide-step-content">
                            <h4>Get Current</h4>
                            <p>Review Next Actions &mdash; mark off completed, add new ones. Review calendar (past 2 weeks for loose ends, upcoming 2 weeks for prep). Review Waiting For &mdash; follow up as needed. Review Projects list &mdash; ensure each has a next action.</p>
                        </div>
                    </div>
                    <div class="gtd-guide-review-step">
                        <div class="gtd-guide-step-number">3</div>
                        <div class="gtd-guide-step-content">
                            <h4>Get Creative</h4>
                            <p>Review Someday/Maybe list &mdash; activate, keep, or remove items. Think about new ideas, goals, or projects. Be creative and courageous.</p>
                        </div>
                    </div>
                </div>

                <h3 class="gtd-guide-section-title">Horizons of Focus <span class="gtd-guide-subtitle">(Periodic bigger-picture reviews)</span></h3>

                <div class="gtd-guide-horizons">
                    <div class="gtd-guide-horizon" style="--horizon-bg: rgba(239,68,68,0.12); --horizon-border: rgba(239,68,68,0.3);">
                        <span class="gtd-guide-horizon-level">Horizon 5</span>
                        <span>Purpose &amp; Principles</span>
                    </div>
                    <div class="gtd-guide-horizon" style="--horizon-bg: rgba(245,158,11,0.12); --horizon-border: rgba(245,158,11,0.3);">
                        <span class="gtd-guide-horizon-level">Horizon 4</span>
                        <span>Long-term Vision (3-5 years)</span>
                    </div>
                    <div class="gtd-guide-horizon" style="--horizon-bg: rgba(234,179,8,0.12); --horizon-border: rgba(234,179,8,0.3);">
                        <span class="gtd-guide-horizon-level">Horizon 3</span>
                        <span>Goals &amp; Objectives (1-2 years)</span>
                    </div>
                    <div class="gtd-guide-horizon" style="--horizon-bg: rgba(16,185,129,0.12); --horizon-border: rgba(16,185,129,0.3);">
                        <span class="gtd-guide-horizon-level">Horizon 2</span>
                        <span>Areas of Focus &amp; Responsibility</span>
                    </div>
                    <div class="gtd-guide-horizon" style="--horizon-bg: rgba(59,130,246,0.12); --horizon-border: rgba(59,130,246,0.3);">
                        <span class="gtd-guide-horizon-level">Horizon 1</span>
                        <span>Current Projects</span>
                    </div>
                    <div class="gtd-guide-horizon" style="--horizon-bg: rgba(129,140,248,0.12); --horizon-border: rgba(129,140,248,0.3);">
                        <span class="gtd-guide-horizon-level">Ground Level</span>
                        <span>Next Actions</span>
                    </div>
                </div>
            </div>

            <!-- ENGAGE -->
            <div class="gtd-guide-panel" data-phase="engage">
                <div class="gtd-guide-principle">
                    <strong>The Core Rule:</strong> Trust your system. If you've captured, clarified, organized, and reviewed,
                    you can be present with whatever you choose to do &mdash; guilt-free.
                </div>

                <h3 class="gtd-guide-section-title">4 Criteria for Choosing Actions</h3>

                <div class="gtd-guide-criteria">
                    <div class="gtd-guide-criterion">
                        <div class="gtd-guide-criterion-ring" style="--ring-color: #818cf8;">1</div>
                        <h4>Context</h4>
                        <p>What can you do <em>here</em> with the <em>tools</em> available?</p>
                    </div>
                    <div class="gtd-guide-criterion">
                        <div class="gtd-guide-criterion-ring" style="--ring-color: #3b82f6;">2</div>
                        <h4>Time</h4>
                        <p>How much time before your next commitment?</p>
                    </div>
                    <div class="gtd-guide-criterion">
                        <div class="gtd-guide-criterion-ring" style="--ring-color: #10b981;">3</div>
                        <h4>Energy</h4>
                        <p>Match the action to your mental and physical state.</p>
                    </div>
                    <div class="gtd-guide-criterion">
                        <div class="gtd-guide-criterion-ring" style="--ring-color: #f59e0b;">4</div>
                        <h4>Priority</h4>
                        <p>Given the above, what gives the <strong>highest return</strong>?</p>
                    </div>
                </div>

                <h3 class="gtd-guide-section-title">3 Models for Daily Work</h3>

                <div class="gtd-guide-cards">
                    <div class="gtd-guide-card" style="--card-accent: #ef4444;">
                        <h4>Pre-defined Work</h4>
                        <p>Working through your Next Actions lists and calendar. The planned, known tasks you've already captured and organized.</p>
                    </div>
                    <div class="gtd-guide-card" style="--card-accent: #f59e0b;">
                        <h4>Work as It Appears</h4>
                        <p>Handling unexpected inputs &mdash; a colleague's request, urgent email, a sudden problem. Conscious choice to engage or capture for later.</p>
                    </div>
                    <div class="gtd-guide-card" style="--card-accent: #10b981;">
                        <h4>Defining Your Work</h4>
                        <p>Processing your inboxes, clarifying items, planning projects. The "meta-work" that keeps your system running.</p>
                    </div>
                </div>

                <div class="gtd-guide-principle">
                    <strong>The Payoff:</strong> A "mind like water" &mdash; a state of readiness with no residual tension.
                    You respond appropriately to whatever shows up because you trust that nothing is falling through the cracks.
                </div>
            </div>
        `

        this.tabsContainer = this.contentContainer.querySelector('.gtd-guide-tabs')
    }
}
